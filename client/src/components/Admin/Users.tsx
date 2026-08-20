import { useMemo, useState, type FormEvent } from 'react';
import {
  Button,
  OGDialog,
  OGDialogContent,
  OGDialogTitle,
  useToastContext,
} from '@librechat/client';
import { Search, UserPlus } from 'lucide-react';
import { SystemRoles, type TAdminUser, type TCreateAdminUser } from 'librechat-data-provider';
import { useAdminUserMutations, useAdminUsers } from '~/data-provider';
import { useLocalize } from '~/hooks';

type DialogState =
  | { type: 'create' }
  | { type: 'edit'; user: TAdminUser }
  | { type: 'password'; user: TAdminUser }
  | { type: 'delete'; user: TAdminUser }
  | null;

const inputClass =
  'w-full rounded-md border border-border-medium bg-surface-primary px-3 py-2 text-text-primary outline-none focus:ring-2 focus:ring-ring-primary';

function UserDialog({ state, close }: { state: DialogState; close: () => void }) {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const mutations = useAdminUserMutations();
  const user = state && state.type !== 'create' ? state.user : undefined;
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [username, setUsername] = useState(user?.username ?? '');
  const [role, setRole] = useState<SystemRoles>(user?.role ?? SystemRoles.USER);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (!state) {
    return null;
  }

  const fail = () => {
    setError(localize('com_admin_users_action_failed'));
    showToast({ status: 'error', message: localize('com_admin_users_action_failed') });
  };
  const done = () => {
    showToast({ status: 'success', message: localize('com_ui_saved') });
    close();
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    try {
      if (state.type === 'create') {
        await mutations.createUser.mutateAsync({ name, email, username, password, role });
      } else if (state.type === 'edit') {
        await mutations.updateUser.mutateAsync({
          id: state.user.id,
          payload: { name, email, username, role },
        });
      } else if (state.type === 'password') {
        await mutations.resetPassword.mutateAsync({ id: state.user.id, password });
      } else {
        await mutations.deleteUser.mutateAsync(state.user.id);
      }
      done();
    } catch {
      fail();
    }
  };

  const title =
    state.type === 'create'
      ? localize('com_admin_users_create')
      : state.type === 'edit'
        ? localize('com_admin_users_edit')
        : state.type === 'password'
          ? localize('com_admin_users_reset_password')
          : localize('com_admin_users_delete');

  return (
    <OGDialog open onOpenChange={(open) => !open && close()}>
      <OGDialogContent className="w-11/12 max-w-md" dir="rtl">
        <OGDialogTitle>{title}</OGDialogTitle>
        <form className="mt-4 space-y-4" onSubmit={submit}>
          {(state.type === 'create' || state.type === 'edit') && (
            <>
              <label className="block text-sm">
                <span>{localize('com_admin_users_name')}</span>
                <input
                  className={inputClass}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  minLength={3}
                />
              </label>
              <label className="block text-sm">
                <span>{localize('com_admin_users_email')}</span>
                <input
                  className={inputClass}
                  dir="ltr"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>
              <label className="block text-sm">
                <span>{localize('com_admin_users_username')}</span>
                <input
                  className={inputClass}
                  dir="ltr"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  minLength={2}
                />
              </label>
              <label className="block text-sm">
                <span>{localize('com_admin_users_role')}</span>
                <select
                  className={inputClass}
                  value={role}
                  onChange={(e) => setRole(e.target.value as SystemRoles)}
                >
                  <option value={SystemRoles.USER}>{localize('com_admin_users_role_user')}</option>
                  <option value={SystemRoles.ADMIN}>
                    {localize('com_admin_users_role_admin')}
                  </option>
                </select>
              </label>
            </>
          )}
          {(state.type === 'create' || state.type === 'password') && (
            <label className="block text-sm">
              <span>{localize('com_admin_users_password')}</span>
              <input
                className={inputClass}
                dir="ltr"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
              />
            </label>
          )}
          {state.type === 'delete' && (
            <p>
              {localize('com_admin_users_delete_confirm')} <strong>{state.user.name}</strong>?
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={close}>
              {localize('com_ui_cancel')}
            </Button>
            <Button
              type="submit"
              disabled={
                mutations.createUser.isLoading ||
                mutations.updateUser.isLoading ||
                mutations.resetPassword.isLoading ||
                mutations.deleteUser.isLoading
              }
            >
              {state.type === 'delete'
                ? localize('com_admin_users_delete')
                : localize('com_ui_save')}
            </Button>
          </div>
        </form>
      </OGDialogContent>
    </OGDialog>
  );
}

export default function AdminUsers() {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [dialog, setDialog] = useState<DialogState>(null);
  const limit = 20;
  const params = useMemo(
    () => ({ q: query.trim() || undefined, limit, offset: page * limit }),
    [query, page],
  );
  const usersQuery = useAdminUsers(params);
  const { setStatus } = useAdminUserMutations();
  const users = usersQuery.data?.users ?? [];
  const action = async (user: TAdminUser) => {
    try {
      await setStatus.mutateAsync({ id: user.id, disabled: !user.disabled });
      showToast({ status: 'success', message: localize('com_ui_saved') });
    } catch {
      showToast({ status: 'error', message: localize('com_admin_users_action_failed') });
    }
  };

  return (
    <main className="h-full overflow-y-auto bg-surface-primary" dir="rtl">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-text-primary">
            {localize('com_admin_users_title')}
          </h1>
          <Button onClick={() => setDialog({ type: 'create' })}>
            <UserPlus className="ml-2 size-4" />
            {localize('com_admin_users_create')}
          </Button>
        </div>
        <label className="relative mb-5 block max-w-md">
          <span className="sr-only">{localize('com_admin_users_search')}</span>
          <Search
            className="absolute right-3 top-2.5 size-5 text-text-secondary"
            aria-hidden="true"
          />
          <input
            className={`${inputClass} pr-10`}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            placeholder={localize('com_admin_users_search')}
          />
        </label>
        {usersQuery.isLoading && <p role="status">{localize('com_ui_loading')}</p>}
        {usersQuery.isError && (
          <p role="alert" className="text-red-600">
            {localize('com_admin_users_load_failed')}
          </p>
        )}
        {!usersQuery.isLoading && !usersQuery.isError && (
          <div className="hidden overflow-x-auto rounded-md border border-border-light md:block">
            <table className="w-full min-w-[850px] border-collapse text-sm">
              <thead className="bg-surface-secondary text-text-secondary">
                <tr>
                  <th className="p-3 text-right">{localize('com_admin_users_name')}</th>
                  <th className="p-3 text-right">{localize('com_admin_users_email')}</th>
                  <th className="p-3 text-right">{localize('com_admin_users_username')}</th>
                  <th className="p-3 text-right">{localize('com_admin_users_role')}</th>
                  <th className="p-3 text-right">{localize('com_admin_users_status')}</th>
                  <th className="p-3 text-right">{localize('com_admin_users_created')}</th>
                  <th className="p-3 text-right">{localize('com_admin_users_actions')}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-t border-border-light">
                    <td className="p-3 font-medium">{user.name}</td>
                    <td className="p-3" dir="ltr">
                      {user.email}
                    </td>
                    <td className="p-3" dir="ltr">
                      {user.username}
                    </td>
                    <td className="p-3">
                      {user.role === SystemRoles.ADMIN
                        ? localize('com_admin_users_role_admin')
                        : localize('com_admin_users_role_user')}
                    </td>
                    <td className="p-3">
                      {user.disabled
                        ? localize('com_admin_users_disabled')
                        : localize('com_admin_users_active')}
                    </td>
                    <td className="p-3">
                      {user.createdAt
                        ? new Intl.DateTimeFormat('he-IL').format(new Date(user.createdAt))
                        : '-'}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="text-primary hover:underline focus-visible:outline focus-visible:outline-2"
                          onClick={() => setDialog({ type: 'edit', user })}
                        >
                          {localize('com_admin_users_edit')}
                        </button>
                        <button
                          className="text-primary hover:underline"
                          onClick={() => setDialog({ type: 'password', user })}
                        >
                          {localize('com_admin_users_reset_password')}
                        </button>
                        <button
                          className="text-primary hover:underline"
                          onClick={() => action(user)}
                        >
                          {user.disabled
                            ? localize('com_admin_users_enable')
                            : localize('com_admin_users_disable')}
                        </button>
                        <button
                          className="text-red-600 hover:underline"
                          onClick={() => setDialog({ type: 'delete', user })}
                        >
                          {localize('com_admin_users_delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!usersQuery.isLoading && !usersQuery.isError && (
          <div className="space-y-3 md:hidden">
            {users.map((user) => (
              <article key={user.id} className="rounded-md border border-border-light p-4">
                <h2 className="font-semibold text-text-primary">{user.name}</h2>
                <p className="mt-1 text-sm text-text-secondary" dir="ltr">
                  {user.email}
                </p>
                <p className="mt-2 text-sm">
                  {user.role === SystemRoles.ADMIN
                    ? localize('com_admin_users_role_admin')
                    : localize('com_admin_users_role_user')}
                  {' · '}
                  {user.disabled
                    ? localize('com_admin_users_disabled')
                    : localize('com_admin_users_active')}
                </p>
                <div className="mt-3 flex flex-wrap gap-3 text-sm">
                  <button
                    className="text-primary hover:underline"
                    onClick={() => setDialog({ type: 'edit', user })}
                  >
                    {localize('com_admin_users_edit')}
                  </button>
                  <button
                    className="text-primary hover:underline"
                    onClick={() => setDialog({ type: 'password', user })}
                  >
                    {localize('com_admin_users_reset_password')}
                  </button>
                  <button className="text-primary hover:underline" onClick={() => action(user)}>
                    {user.disabled
                      ? localize('com_admin_users_enable')
                      : localize('com_admin_users_disable')}
                  </button>
                  <button
                    className="text-red-600 hover:underline"
                    onClick={() => setDialog({ type: 'delete', user })}
                  >
                    {localize('com_admin_users_delete')}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
        <div className="mt-4 flex items-center justify-between">
          <Button variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            {localize('com_ui_previous')}
          </Button>
          <span className="text-sm text-text-secondary">
            {localize('com_admin_users_total')} {usersQuery.data?.total ?? 0}
          </span>
          <Button
            variant="outline"
            disabled={(page + 1) * limit >= (usersQuery.data?.total ?? 0)}
            onClick={() => setPage((p) => p + 1)}
          >
            {localize('com_ui_next')}
          </Button>
        </div>
      </div>
      <UserDialog
        key={dialog ? `${dialog.type}-${'user' in dialog ? dialog.user.id : 'new'}` : 'closed'}
        state={dialog}
        close={() => setDialog(null)}
      />
    </main>
  );
}
