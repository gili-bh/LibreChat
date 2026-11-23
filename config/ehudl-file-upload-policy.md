# Ehud Levitan LibreChat: attachment policy (proposed)

This document is a **reviewable configuration proposal**, not the active config.
Production uses the Railway service `cooperative-trust`, whose start command
writes `$LIBRECHAT_CONFIG` to `/app/librechat.yaml`. The repository's example
YAML is NOT loaded at runtime. Never replace `LIBRECHAT_CONFIG` wholesale
without exporting and reviewing its existing value, or copy credentials into git.

## Recommended config fragment to merge into the existing YAML

```yaml
fileConfig:
  serverFileSizeLimit: 25
  clientImageResize:
    enabled: true
    maxWidth: 1900
    maxHeight: 1900
  endpoints:
    default:
      fileLimit: 5
      fileSizeLimit: 25
      totalSizeLimit: 50
      supportedMimeTypes:
        - "image/png"
        - "image/jpeg"
        - "image/webp"
        - "application/pdf"
        - "text/plain"
        - "text/csv"
        - "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        - "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        - "application/vnd.openxmlformats-officedocument.presentationml.presentation"
```

These are proposed per-request limits: **5 files**, **25 MB per file**, and **50 MB
total**. Verify the `default` endpoint policy applies to the relevant
Agents endpoint in the deployed LibreChat version. Existing endpoint-specific
settings must be preserved or intentionally merged, not overwritten.

Do not allow `.xlsm` just by adding its MIME type: currently the upload
pipeline rejects
`application/vnd.ms-excel.sheet.macroenabled.12`. Enabling the MIME type
is only a first step; the parser must safely process the workbook without
executing macros. Keep executable formats disabled.

## Image handling is a separate configuration issue

Production logs on 2026-11-23 repeatedly show
`This model does not support images`. The selected **agent model** and
provider must support image input; file upload permission alone is insufficient.

1. Review the model attached to each affected agent, not just the site-wide
   list of selectable models.
2. Select an image-capable Gemini or OpenAI model that is both enabled and
   billed, and ensure its provider integration accepts image parts.
3. Test on a new conversation with a small JPEG containing visible text.
4. Verify the same behavior with a non-admin account.

## Other outstanding issues (not resolved by this fragment)

- `RAG API text parsing failed` (HTTP 400): inspect RAG deployment and file
  parser routing before enabling scanned-PDF workflows.
- `empty_messages` on a 26k-token message with ~21k context: inspect each
  agent's maximum context and summarization/truncation configuration.
- `Error uploading code environment file` (HTTP 401): inspect the code
  execution integration credentials and permissions.
- `XLSM` unsupported type: implement a read-only, sandboxed parser first.

## Release gate

Before rollout: back up the active `LIBRECHAT_CONFIG` privately, validate YAML,
stage on a non-production deployment, and test JPEG, PDF, DOCX, XLSX, small
multi-file uploads, >25MB rejection, file-parser failures, and agent permissions.
Measure API cost, set per-user/provider usage budgets, then deploy to production
only after the checks pass.
