import { fireEvent, render, screen, within } from '@testing-library/react';
import AdminUsers from '../Users';

const mockMutateAsync = jest.fn().mockResolvedValue({});
jest.mock('~/hooks', () => ({ useLocalize: () => (key: string) => key }));
jest.mock('~/data-provider', () => ({
  useAdminUsers: () => ({
    data: {
      users: [
        {
          id: 'user-1',
          name: 'Gili Ben Hamo',
          username: 'gili',
          email: 'gili@example.com',
          role: 'USER',
          provider: 'local',
          disabled: false,
          emailVerified: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          avatar: '',
        },
      ],
      total: 1,
    },
    isLoading: false,
    isError: false,
  }),
  useAdminUserMutations: () => ({
    createUser: { mutateAsync: mockMutateAsync, isLoading: false },
    updateUser: { mutateAsync: mockMutateAsync, isLoading: false },
    resetPassword: { mutateAsync: mockMutateAsync, isLoading: false },
    setStatus: { mutateAsync: mockMutateAsync, isLoading: false },
    deleteUser: { mutateAsync: mockMutateAsync, isLoading: false },
  }),
}));
jest.mock('@librechat/client', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  OGDialog: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  OGDialogContent: ({ children }: { children: React.ReactNode }) => (
    <div role="dialog">{children}</div>
  ),
  OGDialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  useToastContext: () => ({ showToast: jest.fn() }),
}));

describe('AdminUsers', () => {
  it('opens the create-user dialog', () => {
    render(<AdminUsers />);
    fireEvent.click(screen.getByRole('button', { name: 'com_admin_users_create' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('com_admin_users_create');
  });

  it.each([
    ['com_admin_users_reset_password', 'com_admin_users_reset_password'],
    ['com_admin_users_delete', 'com_admin_users_delete_confirm'],
  ])('opens the %s confirmation dialog', (action, expected) => {
    render(<AdminUsers />);
    fireEvent.click(screen.getAllByRole('button', { name: action })[0]);
    expect(screen.getByRole('dialog')).toHaveTextContent(expected);
  });

  it('isolates an English user name inside the RTL delete sentence', () => {
    render(<AdminUsers />);
    fireEvent.click(screen.getAllByRole('button', { name: 'com_admin_users_delete' })[0]);

    const name = within(screen.getByRole('dialog')).getByText('Gili Ben Hamo');
    expect(name.textContent).toBe('Gili Ben Hamo');
    expect(name.tagName).toBe('BDI');
    expect(name).toHaveAttribute('dir', 'auto');
  });
});
