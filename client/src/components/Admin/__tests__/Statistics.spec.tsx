import { fireEvent, render, screen } from '@testing-library/react';
import AdminStatistics from '../Statistics';

const mockUseStatistics = jest.fn();
jest.mock('~/hooks', () => ({ useLocalize: () => (key: string) => key }));
jest.mock('~/data-provider', () => ({
  useAdminUsageStatistics: (days: number) => mockUseStatistics(days),
}));

const statistics = {
  registeredUsers: 55,
  activeUsersToday: 4,
  activeUsers7Days: 20,
  activeUsers30Days: 40,
  conversationsToday: 8,
  conversations7Days: 50,
  conversations30Days: 160,
  messagesToday: 20,
  messages7Days: 140,
  messages30Days: 500,
  conversationsWithFiles: 12,
  totalUploadedFiles: 18,
  rangeDays: 30,
  daily: [{ date: '2026-08-20', messages: 20, conversations: 8, activeUsers: 4 }],
};

describe('AdminStatistics', () => {
  beforeEach(() =>
    mockUseStatistics.mockReturnValue({ data: statistics, isLoading: false, isError: false }),
  );

  it('renders metric cards and charts', () => {
    render(<AdminStatistics />);
    expect(screen.getByText('com_admin_statistics_title')).toBeInTheDocument();
    expect(screen.getByText('55')).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'com_admin_statistics_messages_chart' }),
    ).toBeInTheDocument();
  });

  it('switches the chart range', () => {
    render(<AdminStatistics />);
    fireEvent.click(screen.getByRole('button', { name: '90 com_admin_statistics_days' }));
    expect(mockUseStatistics).toHaveBeenLastCalledWith(90);
  });
});
