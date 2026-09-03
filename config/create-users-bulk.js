const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { z } = require('zod');
const { SystemRoles } = require('librechat-data-provider');
const { createModels, runAsSystem } = require('@librechat/data-schemas');
require('dotenv').config();
require('module-alias')({ base: path.resolve(__dirname, '..', 'api') });

const MAX_USERS = 100;
const MAX_PASSWORD_LENGTH = 128;
const USERNAME_PATTERN = /^[\p{L}\p{N}_.@#$%&*()]+$/u;
const { User } = createModels(mongoose);
const usernameSchema = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(USERNAME_PATTERN)
  .transform((value) => value.toLowerCase());

function parseArgs(argv) {
  const options = { apply: false };
  for (const arg of argv) {
    if (arg === '--apply') {
      options.apply = true;
      continue;
    }
    if (arg.startsWith('--file=')) {
      options.file = arg.slice('--file='.length);
      continue;
    }
    if (arg.startsWith('--tenant-admin-email=')) {
      options.tenantAdminEmail = arg.slice('--tenant-admin-email='.length).trim().toLowerCase();
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  if (!options.file) {
    throw new Error('Missing --file=<path-to-users.json>');
  }
  if (!options.tenantAdminEmail) {
    throw new Error('Missing --tenant-admin-email=<admin-email>');
  }
  return options;
}

function getPasswordPolicy() {
  const configured = Number.parseInt(process.env.MIN_PASSWORD_LENGTH ?? '8', 10);
  return Math.max(8, Number.isFinite(configured) ? configured : 8);
}

function createInputSchema(minPasswordLength) {
  return z
    .array(
      z
        .object({
          name: z.string().trim().min(3).max(80),
          email: z
            .string()
            .trim()
            .email()
            .max(320)
            .transform((value) => value.toLowerCase()),
          username: usernameSchema.optional(),
          password: z
            .string()
            .min(minPasswordLength)
            .max(MAX_PASSWORD_LENGTH)
            .refine((value) => value.trim().length > 0, 'Password cannot be only spaces'),
          emailVerified: z.boolean().default(true),
        })
        .strict(),
    )
    .min(1)
    .max(MAX_USERS);
}

function normalizeUsers(input, minPasswordLength) {
  const parsed = createInputSchema(minPasswordLength).safeParse(input);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    throw new Error(`Invalid bulk user input:\n${issues.join('\n')}`);
  }

  const users = parsed.data.map((user, index) => {
    const username = usernameSchema.safeParse(user.username ?? user.email.split('@')[0]);
    if (!username.success) {
      throw new Error(`Invalid bulk user input:\n${index}.username: Invalid username`);
    }
    return { ...user, username: username.data };
  });
  const seenEmails = new Set();
  const seenUsernames = new Set();
  for (const user of users) {
    if (seenEmails.has(user.email)) {
      throw new Error(`Duplicate email in input: ${user.email}`);
    }
    if (seenUsernames.has(user.username)) {
      throw new Error(`Duplicate username in input: ${user.username}`);
    }
    seenEmails.add(user.email);
    seenUsernames.add(user.username);
  }
  return users;
}

function getTenantFilter(tenantId) {
  return tenantId ? { tenantId } : { tenantId: null };
}

async function findTenantAnchor(email) {
  const anchors = await runAsSystem(async () =>
    User.find({ email }).select('_id email role tenantId').lean(),
  );
  if (anchors.length === 0) {
    throw new Error(`Tenant admin not found: ${email}`);
  }
  if (anchors.length > 1) {
    throw new Error(`Tenant admin email is ambiguous across tenants: ${email}`);
  }
  if (anchors[0].role !== SystemRoles.ADMIN) {
    throw new Error(`Tenant anchor is not an administrator: ${email}`);
  }
  return anchors[0];
}

async function planImport(users, tenantId) {
  const existing = await runAsSystem(async () =>
    User.find({
      ...getTenantFilter(tenantId),
      $or: [
        { email: { $in: users.map((user) => user.email) } },
        { username: { $in: users.map((user) => user.username) } },
      ],
    })
      .select('email username')
      .lean(),
  );
  const existingEmails = new Set(existing.map((user) => user.email));
  const existingUsernames = new Set(existing.map((user) => user.username));
  const skipped = [];
  const ready = [];
  for (const user of users) {
    if (existingEmails.has(user.email)) {
      skipped.push({ email: user.email, reason: 'email already exists' });
      continue;
    }
    if (existingUsernames.has(user.username)) {
      skipped.push({ email: user.email, reason: 'username already exists' });
      continue;
    }
    ready.push(user);
  }
  return { ready, skipped };
}

async function mapWithConcurrency(items, concurrency, operation) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await operation(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

async function createUsers(users, tenantId) {
  return await runAsSystem(async () =>
    mapWithConcurrency(users, 4, async (user) => {
      try {
        const password = await bcrypt.hash(user.password, 10);
        const created = await User.create({
          name: user.name,
          email: user.email,
          username: user.username,
          password,
          role: SystemRoles.USER,
          provider: 'local',
          disabled: false,
          emailVerified: user.emailVerified,
          ...(tenantId ? { tenantId } : {}),
        });
        return { email: user.email, status: 'created', id: created._id.toString() };
      } catch (error) {
        const duplicate = error && typeof error === 'object' && error.code === 11000;
        return {
          email: user.email,
          status: 'failed',
          reason: duplicate ? 'email or username already exists' : 'database write failed',
        };
      }
    }),
  );
}

function printSummary(plan, results = []) {
  for (const item of plan.skipped) {
    console.log(`SKIPPED ${item.email}: ${item.reason}`);
  }
  for (const item of results) {
    console.log(
      `${item.status.toUpperCase()} ${item.email}${item.reason ? `: ${item.reason}` : ''}`,
    );
  }
  const created = results.filter((item) => item.status === 'created').length;
  const failed = results.filter((item) => item.status === 'failed').length;
  console.log(
    `Summary: ready=${plan.ready.length}, created=${created}, skipped=${plan.skipped.length}, failed=${failed}`,
  );
}

async function main() {
  let exitCode = 0;
  try {
    const options = parseArgs(process.argv.slice(2));
    const inputPath = path.resolve(process.cwd(), options.file);
    const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    const minPasswordLength = getPasswordPolicy();
    const users = normalizeUsers(input, minPasswordLength);
    const connect = require('./connect');
    await connect();
    const anchor = await findTenantAnchor(options.tenantAdminEmail);
    const plan = await planImport(users, anchor.tenantId);

    if (!options.apply) {
      printSummary(plan);
      console.log('Dry run only. Re-run with --apply to create the ready users.');
      return;
    }

    const results = await createUsers(plan.ready, anchor.tenantId);
    printSummary(plan, results);
    exitCode = results.some((item) => item.status === 'failed') ? 1 : 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Bulk user import failed');
    exitCode = 1;
  } finally {
    await mongoose.disconnect();
    process.exitCode = exitCode;
  }
}

if (require.main === module) {
  void main();
}

module.exports = {
  MAX_USERS,
  createInputSchema,
  getPasswordPolicy,
  normalizeUsers,
  parseArgs,
};
