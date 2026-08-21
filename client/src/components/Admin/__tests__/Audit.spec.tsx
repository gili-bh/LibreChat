import { fireEvent, render, screen } from '@testing-library/react';
import AdminAudit from '../Audit';

const mockUseAdminAudit = jest.fn();
const mockUseConversation = jest.fn();
jest.mock('~/hooks', () => ({ useLocalize: () => (key: string) => key }));
jest.mock('~/data-provider', () => ({
  useAdminAudit: (filters: object) => mockUseAdminAudit(filters),
  useAdminAuditConversation: (id: string, page: object) => mockUseConversation(id, page),
  useAdminUsageEmployees: () => ({
    data: { employees: [{ id: 'employee-1', name: 'Gili', email: 'gili@example.com' }] },
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
}));

const conversation = {
  conversationId: 'conversation-1',
  title: 'Engineering question',
  employee: { id: 'employee-1', name: 'Gili', email: 'gili@example.com' },
  preview: 'Please review this document',
  messageCount: 2,
  fileCount: 1,
  createdAt: '2026-08-20T08:00:00.000Z',
  updatedAt: '2026-08-20T09:00:00.000Z',
};

describe('AdminAudit', () => {
  beforeEach(() => {
    mockUseAdminAudit.mockReturnValue({
      data: { conversations: [conversation], total: 25 },
      isLoading: false,
      isError: false,
    });
    mockUseConversation.mockReturnValue({
      data: {
        ...conversation,
        messages: [
          {
            messageId: 'm1',
            sender: 'Gili',
            text: 'Message text',
            isCreatedByUser: true,
            createdAt: conversation.createdAt,
          },
        ],
        files: [{ fileId: 'f1', filename: 'report.pdf', type: 'application/pdf', bytes: 1024 }],
        messageTotal: 1,
        limit: 25,
        offset: 0,
      },
      isLoading: false,
      isError: false,
    });
  });

  it('renders the audit page and applies search and filters', () => {
    render(<AdminAudit />);
    expect(screen.getByText('com_admin_audit_title')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('com_admin_users_search'), {
      target: { value: 'contract' },
    });
    fireEvent.change(screen.getByLabelText('com_admin_audit_employee'), {
      target: { value: 'employee-1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'com_admin_audit_apply_filters' }));
    expect(mockUseAdminAudit).toHaveBeenLastCalledWith(
      expect.objectContaining({ q: 'contract', employeeId: 'employee-1', offset: 0 }),
    );
  });

  it('opens the read-only conversation inspector', () => {
    render(<AdminAudit />);
    fireEvent.click(screen.getAllByRole('button', { name: 'com_admin_audit_open' })[0]);
    expect(screen.getByRole('dialog')).toHaveTextContent('Message text');
    expect(screen.getByRole('dialog')).toHaveTextContent('report.pdf');
    expect(screen.queryByText(/resend|continue|edit/i)).not.toBeInTheDocument();
  });

  it('paginates the audit results', () => {
    render(<AdminAudit />);
    fireEvent.click(screen.getByRole('button', { name: 'com_ui_next' }));
    expect(mockUseAdminAudit).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 20 }));
  });
});
