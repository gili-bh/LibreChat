import { useMemo, useState } from 'react';
import { useAdminUsageStatistics } from '~/data-provider';
import { useLocalize } from '~/hooks';

const metricKeys = [
  'registeredUsers',
  'activeUsersToday',
  'activeUsers7Days',
  'activeUsers30Days',
  'conversationsToday',
  'conversations7Days',
  'conversations30Days',
  'messagesToday',
  'messages7Days',
  'messages30Days',
  'conversationsWithFiles',
  'totalUploadedFiles',
] as const;

function UsageChart({
  title,
  values,
}: {
  title: string;
  values: Array<{ date: string; value: number }>;
}) {
  const max = Math.max(1, ...values.map((item) => item.value));
  return (
    <section className="border-t border-border-light py-5" aria-label={title}>
      <h2 className="mb-4 font-semibold">{title}</h2>
      <div className="flex h-48 items-end gap-1" role="img" aria-label={title}>
        {values.map((item) => (
          <div
            key={item.date}
            className="group relative flex min-w-0 flex-1 items-end"
            style={{ height: '100%' }}
          >
            <div
              className="w-full bg-primary transition-opacity hover:opacity-80"
              style={{ height: `${Math.max(2, (item.value / max) * 100)}%` }}
              aria-label={`${item.date}: ${item.value}`}
            />
            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded bg-black px-2 py-1 text-xs text-white group-hover:block">
              {item.date}: {item.value}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-text-secondary">
        <span>{values[0]?.date}</span>
        <span>{values.at(-1)?.date}</span>
      </div>
    </section>
  );
}

export default function AdminStatistics() {
  const localize = useLocalize();
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const query = useAdminUsageStatistics(days);
  const daily = useMemo(() => {
    const values = new Map(query.data?.daily.map((item) => [item.date, item]) ?? []);
    const today = new Date();
    return Array.from({ length: days }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (days - index - 1));
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      return values.get(key) ?? { date: key, messages: 0, conversations: 0, activeUsers: 0 };
    });
  }, [days, query.data?.daily]);
  return (
    <main className="h-full overflow-y-auto bg-surface-primary" dir="rtl">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold">{localize('com_admin_statistics_title')}</h1>
          <div
            className="flex rounded-md border border-border-medium p-1"
            role="group"
            aria-label={localize('com_admin_statistics_range')}
          >
            {([7, 30, 90] as const).map((value) => (
              <button
                key={value}
                className={`rounded px-3 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 ${days === value ? 'bg-primary text-white' : 'hover:bg-surface-secondary'}`}
                aria-pressed={days === value}
                onClick={() => setDays(value)}
              >
                {value} {localize('com_admin_statistics_days')}
              </button>
            ))}
          </div>
        </div>
        {query.isLoading && (
          <p role="status" className="py-10">
            {localize('com_ui_loading')}
          </p>
        )}
        {query.isError && (
          <p role="alert" className="py-10 text-red-600">
            {localize('com_admin_statistics_load_error')}
          </p>
        )}
        {query.data && (
          <>
            <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
              {metricKeys.map((key) => (
                <section key={key} className="rounded-md border border-border-light p-4">
                  <p className="text-sm text-text-secondary">
                    {localize(`com_admin_statistics_${key}`)}
                  </p>
                  <p className="mt-2 text-2xl font-semibold">
                    {new Intl.NumberFormat('he-IL').format(query.data[key])}
                  </p>
                </section>
              ))}
            </div>
            <div className="mt-8">
              <UsageChart
                title={localize('com_admin_statistics_messages_chart')}
                values={daily.map((item) => ({ date: item.date, value: item.messages }))}
              />
              <UsageChart
                title={localize('com_admin_statistics_conversations_chart')}
                values={daily.map((item) => ({
                  date: item.date,
                  value: item.conversations,
                }))}
              />
              <UsageChart
                title={localize('com_admin_statistics_active_chart')}
                values={daily.map((item) => ({
                  date: item.date,
                  value: item.activeUsers,
                }))}
              />
            </div>
          </>
        )}
      </div>
    </main>
  );
}
