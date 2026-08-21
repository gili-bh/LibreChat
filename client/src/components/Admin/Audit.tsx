import { useMemo, useState, type FormEvent } from 'react';
import { Button, OGDialog, OGDialogContent, OGDialogTitle } from '@librechat/client';
import { FileText, Search, X } from 'lucide-react';
import type { TAdminAuditConversation, TAdminUsageFilters } from 'librechat-data-provider';
import { useAdminAudit, useAdminAuditConversation, useAdminUsageEmployees } from '~/data-provider';
import { useLocalize } from '~/hooks';

const inputClass =
  'w-full rounded-md border border-border-medium bg-surface-primary px-3 py-2 text-text-primary outline-none focus:ring-2 focus:ring-ring-primary';
const formatDate = (value?: string) =>
  value
    ? new Intl.DateTimeFormat('he-IL', { dateStyle: 'short', timeStyle: 'short' }).format(
        new Date(value),
      )
    : '-';
const columns = [
  'com_admin_audit_column_time',
  'com_admin_audit_column_employee',
  'com_admin_audit_column_email',
  'com_admin_audit_column_conversation',
  'com_admin_audit_column_preview',
  'com_admin_audit_column_messages',
  'com_admin_audit_column_files',
  'com_admin_audit_column_updated',
  'com_admin_audit_column_actions',
] as const;

function ConversationInspector({
  conversation,
  close,
}: {
  conversation: TAdminAuditConversation;
  close: () => void;
}) {
  const localize = useLocalize();
  const [page, setPage] = useState(0);
  const limit = 25;
  const detail = useAdminAuditConversation(conversation.conversationId, {
    limit,
    offset: page * limit,
  });
  return (
    <OGDialog open onOpenChange={(open) => !open && close()}>
      <OGDialogContent className="max-h-[92vh] w-11/12 max-w-3xl overflow-y-auto" dir="rtl">
        <OGDialogTitle>{detail.data?.title || conversation.title}</OGDialogTitle>
        <p className="mt-1 text-sm text-text-secondary">
          <bdi dir="auto">{detail.data?.employee.name || conversation.employee.name}</bdi>
          {' · '}
          {formatDate(detail.data?.createdAt || conversation.createdAt)}
        </p>
        {detail.isLoading && (
          <p role="status" className="py-8">
            {localize('com_ui_loading')}
          </p>
        )}
        {detail.isError && (
          <p role="alert" className="py-8 text-red-600">
            {localize('com_admin_audit_inspector_error')}
          </p>
        )}
        {detail.data && (
          <>
            {detail.data.files.length > 0 && (
              <section
                className="mt-5 border-y border-border-light py-4"
                aria-labelledby="audit-files-title"
              >
                <h3 id="audit-files-title" className="mb-2 font-semibold">
                  {localize('com_admin_audit_files')}
                </h3>
                <ul className="space-y-1 text-sm">
                  {detail.data.files.map((file) => (
                    <li key={file.fileId} className="flex items-center gap-2">
                      <FileText className="size-4" aria-hidden="true" />
                      <bdi dir="auto">{file.filename}</bdi>
                      <span className="text-text-secondary">
                        ({Math.ceil(file.bytes / 1024)} KB)
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <section className="mt-5" aria-labelledby="audit-timeline-title">
              <h3 id="audit-timeline-title" className="mb-3 font-semibold">
                {localize('com_admin_audit_timeline')}
              </h3>
              {detail.data.messages.length === 0 ? (
                <p className="text-text-secondary">{localize('com_admin_audit_empty_messages')}</p>
              ) : (
                <ol className="space-y-3">
                  {detail.data.messages.map((message) => (
                    <li
                      key={message.messageId}
                      className={`rounded-md border border-border-light p-3 ${message.isCreatedByUser ? 'bg-surface-secondary' : 'bg-surface-primary'}`}
                    >
                      <div className="mb-2 flex justify-between gap-3 text-xs text-text-secondary">
                        <span>
                          {message.isCreatedByUser
                            ? localize('com_admin_audit_employee_message')
                            : localize('com_admin_audit_assistant_message')}
                        </span>
                        <time dateTime={message.createdAt}>{formatDate(message.createdAt)}</time>
                      </div>
                      <p className="whitespace-pre-wrap break-words" dir="auto">
                        {message.text}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </section>
            <div className="mt-5 flex items-center justify-between">
              <Button
                variant="outline"
                disabled={page === 0}
                onClick={() => setPage((value) => value - 1)}
              >
                {localize('com_ui_previous')}
              </Button>
              <span className="text-sm text-text-secondary">{detail.data.messageTotal}</span>
              <Button
                variant="outline"
                disabled={(page + 1) * limit >= detail.data.messageTotal}
                onClick={() => setPage((value) => value + 1)}
              >
                {localize('com_ui_next')}
              </Button>
            </div>
          </>
        )}
      </OGDialogContent>
    </OGDialog>
  );
}

export default function AdminAudit() {
  const localize = useLocalize();
  const [draft, setDraft] = useState<TAdminUsageFilters>({});
  const [filters, setFilters] = useState<TAdminUsageFilters>({ limit: 20, offset: 0 });
  const [selected, setSelected] = useState<TAdminAuditConversation | null>(null);
  const page = Math.floor((filters.offset ?? 0) / (filters.limit ?? 20));
  const employees = useAdminUsageEmployees();
  const query = useAdminAudit(filters);
  const rows = query.data?.conversations ?? [];
  const setDraftField = (name: keyof TAdminUsageFilters, value: string) =>
    setDraft((current) => ({ ...current, [name]: value || undefined }));
  const apply = (event: FormEvent) => {
    event.preventDefault();
    setFilters({ ...draft, limit: 20, offset: 0 });
  };
  const clear = () => {
    setDraft({});
    setFilters({ limit: 20, offset: 0 });
  };
  const total = query.data?.total ?? 0;
  const employeeOptions = useMemo(() => employees.data?.employees ?? [], [employees.data]);

  return (
    <main className="h-full overflow-y-auto bg-surface-primary" dir="rtl">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8">
        <h1 className="text-2xl font-semibold text-text-primary">
          {localize('com_admin_audit_title')}
        </h1>
        <p className="mt-2 max-w-4xl text-sm text-text-secondary">
          {localize('com_admin_audit_description')}
        </p>
        <form
          onSubmit={apply}
          className="mt-6 grid gap-3 border-y border-border-light py-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <label className="text-sm">
            <span>{localize('com_admin_audit_employee')}</span>
            <select
              className={inputClass}
              value={draft.employeeId ?? ''}
              onChange={(e) => setDraftField('employeeId', e.target.value)}
            >
              <option value="">{localize('com_admin_audit_all_employees')}</option>
              {employeeOptions.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name} ({employee.email})
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span>{localize('com_admin_users_email')}</span>
            <input
              className={inputClass}
              dir="ltr"
              type="search"
              value={draft.email ?? ''}
              onChange={(e) => setDraftField('email', e.target.value)}
            />
          </label>
          <label className="text-sm">
            <span>{localize('com_admin_audit_from')}</span>
            <input
              className={inputClass}
              dir="ltr"
              type="date"
              value={draft.from ?? ''}
              onChange={(e) => setDraftField('from', e.target.value)}
            />
          </label>
          <label className="text-sm">
            <span>{localize('com_admin_audit_to')}</span>
            <input
              className={inputClass}
              dir="ltr"
              type="date"
              value={draft.to ?? ''}
              onChange={(e) => setDraftField('to', e.target.value)}
            />
          </label>
          <label className="text-sm">
            <span>{localize('com_admin_audit_file_filter')}</span>
            <select
              className={inputClass}
              value={draft.files ?? ''}
              onChange={(e) => setDraftField('files', e.target.value)}
            >
              <option value="">{localize('com_admin_audit_all_conversations')}</option>
              <option value="with">{localize('com_admin_audit_with_files')}</option>
              <option value="without">{localize('com_admin_audit_without_files')}</option>
            </select>
          </label>
          <label className="text-sm sm:col-span-2">
            <span>{localize('com_admin_users_search')}</span>
            <div className="relative">
              <Search
                className="absolute right-3 top-2.5 size-5 text-text-secondary"
                aria-hidden="true"
              />
              <input
                className={`${inputClass} pr-10`}
                type="search"
                value={draft.q ?? ''}
                onChange={(e) => setDraftField('q', e.target.value)}
              />
            </div>
          </label>
          <div className="flex items-end gap-2">
            <Button type="submit">{localize('com_admin_audit_apply_filters')}</Button>
            <Button type="button" variant="outline" onClick={clear}>
              <X className="ml-1 size-4" aria-hidden="true" />
              {localize('com_admin_audit_clear')}
            </Button>
          </div>
        </form>
        {query.isLoading && (
          <p role="status" className="py-10">
            {localize('com_ui_loading')}
          </p>
        )}
        {query.isError && (
          <p role="alert" className="py-10 text-red-600">
            {localize('com_admin_audit_load_error')}
          </p>
        )}
        {!query.isLoading && !query.isError && rows.length === 0 && (
          <p className="py-10 text-center text-text-secondary">
            {localize('com_admin_audit_empty')}
          </p>
        )}
        {rows.length > 0 && (
          <>
            <div className="mt-5 hidden overflow-x-auto rounded-md border border-border-light lg:block">
              <table className="w-full min-w-[1050px] text-sm">
                <thead className="bg-surface-secondary text-text-secondary">
                  <tr>
                    {columns.map((key) => (
                      <th key={key} className="p-3 text-right">
                        {localize(key)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.conversationId} className="border-t border-border-light">
                      <td className="p-3">{formatDate(row.createdAt)}</td>
                      <td className="p-3">
                        <bdi dir="auto">{row.employee.name}</bdi>
                      </td>
                      <td className="p-3" dir="ltr">
                        {row.employee.email}
                      </td>
                      <td className="max-w-48 truncate p-3">{row.title}</td>
                      <td className="max-w-64 truncate p-3" dir="auto">
                        {row.preview}
                      </td>
                      <td className="p-3">{row.messageCount}</td>
                      <td className="p-3">{row.fileCount}</td>
                      <td className="p-3">{formatDate(row.updatedAt)}</td>
                      <td className="p-3">
                        <button
                          className="text-primary hover:underline focus-visible:outline focus-visible:outline-2"
                          onClick={() => setSelected(row)}
                        >
                          {localize('com_admin_audit_open')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-5 space-y-3 lg:hidden">
              {rows.map((row) => (
                <article
                  key={row.conversationId}
                  className="rounded-md border border-border-light p-4"
                >
                  <div className="flex justify-between gap-3">
                    <h2 className="font-semibold">{row.title}</h2>
                    <time className="text-xs text-text-secondary">{formatDate(row.updatedAt)}</time>
                  </div>
                  <p className="mt-1 text-sm">
                    <bdi dir="auto">{row.employee.name}</bdi> ·{' '}
                    <bdi dir="ltr">{row.employee.email}</bdi>
                  </p>
                  <p className="mt-3 line-clamp-3 text-sm text-text-secondary" dir="auto">
                    {row.preview}
                  </p>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span>
                      {row.messageCount} {localize('com_admin_audit_messages')} · {row.fileCount}{' '}
                      {localize('com_admin_audit_files')}
                    </span>
                    <button
                      className="text-primary hover:underline"
                      onClick={() => setSelected(row)}
                    >
                      {localize('com_admin_audit_open')}
                    </button>
                  </div>
                </article>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between">
              <Button
                variant="outline"
                disabled={page === 0}
                onClick={() =>
                  setFilters((value) => ({
                    ...value,
                    offset: Math.max(0, (value.offset ?? 0) - 20),
                  }))
                }
              >
                {localize('com_ui_previous')}
              </Button>
              <span className="text-sm text-text-secondary">{total}</span>
              <Button
                variant="outline"
                disabled={(page + 1) * 20 >= total}
                onClick={() =>
                  setFilters((value) => ({ ...value, offset: (value.offset ?? 0) + 20 }))
                }
              >
                {localize('com_ui_next')}
              </Button>
            </div>
          </>
        )}
      </div>
      {selected && (
        <ConversationInspector conversation={selected} close={() => setSelected(null)} />
      )}
    </main>
  );
}
