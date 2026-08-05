import { renderHook } from '@testing-library/react';
import { SystemRoles } from 'librechat-data-provider';
import { useAuthContext } from '../AuthContext';
import useAdminInterface from '../useAdminInterface';

jest.mock('../AuthContext', () => ({
  useAuthContext: jest.fn(),
}));

const mockUseAuthContext = useAuthContext as jest.MockedFunction<typeof useAuthContext>;

describe('useAdminInterface', () => {
  it('enables the advanced interface for administrators', () => {
    mockUseAuthContext.mockReturnValue({
      user: { role: SystemRoles.ADMIN },
    } as ReturnType<typeof useAuthContext>);

    const { result } = renderHook(() => useAdminInterface());

    expect(result.current).toBe(true);
  });

  it('keeps the advanced interface hidden for standard users', () => {
    mockUseAuthContext.mockReturnValue({
      user: { role: SystemRoles.USER },
    } as ReturnType<typeof useAuthContext>);

    const { result } = renderHook(() => useAdminInterface());

    expect(result.current).toBe(false);
  });
});
