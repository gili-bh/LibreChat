import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SystemRoles } from 'librechat-data-provider';
import AdminRoute from '../AdminRoute';

let mockRole = SystemRoles.USER;
jest.mock('~/hooks/AuthContext', () => ({
  useAuthContext: () => ({ user: { role: mockRole } }),
}));

const renderRoute = () =>
  render(
    <MemoryRouter initialEntries={['/admin/users']}>
      <Routes>
        <Route element={<AdminRoute />}>
          <Route path="/admin/users" element={<div>admin users</div>} />
        </Route>
        <Route path="/c/new" element={<div>chat</div>} />
      </Routes>
    </MemoryRouter>,
  );

describe('AdminRoute', () => {
  it('redirects a standard user', () => {
    mockRole = SystemRoles.USER;
    renderRoute();
    expect(screen.getByText('chat')).toBeInTheDocument();
    expect(screen.queryByText('admin users')).not.toBeInTheDocument();
  });

  it('renders the page for a built-in administrator', () => {
    mockRole = SystemRoles.ADMIN;
    renderRoute();
    expect(screen.getByText('admin users')).toBeInTheDocument();
  });
});
