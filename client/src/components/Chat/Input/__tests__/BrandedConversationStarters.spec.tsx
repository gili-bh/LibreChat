import React from 'react';
import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import BrandedConversationStarters from '../BrandedConversationStarters';

const mockSetValue = jest.fn();

const translations: Record<string, string> = {
  com_ui_home_starter_summarize: 'סכם מסמך שהעליתי',
  com_ui_home_starter_summarize_description: 'העלה מסמך ואסכם עבורך את הנקודות החשובות',
  com_ui_home_starter_email: 'נסח עבורי מייל מקצועי',
  com_ui_home_starter_email_description: 'אעזור לך לנסח מייל ברור, מקצועי ומדויק',
  com_ui_home_starter_analyze: 'עזור לי לנתח שאלה מקצועית',
  com_ui_home_starter_analyze_description: 'שאל אותי שאלה הנדסית, חוזית או מקצועית אחרת',
};

jest.mock('~/Providers', () => ({
  useChatFormContext: () => ({ setValue: mockSetValue }),
}));

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) => translations[key] ?? key,
}));

describe('BrandedConversationStarters', () => {
  beforeEach(() => {
    mockSetValue.mockClear();
  });

  it('renders all branded starter cards and their descriptions', () => {
    render(<BrandedConversationStarters />);

    expect(screen.getAllByRole('button')).toHaveLength(3);
    expect(screen.getByText(translations.com_ui_home_starter_summarize)).toBeInTheDocument();
    expect(
      screen.getByText(translations.com_ui_home_starter_email_description),
    ).toBeInTheDocument();
    expect(screen.getByText(translations.com_ui_home_starter_analyze)).toBeInTheDocument();
  });

  it('inserts the title and focuses the composer when activated by keyboard', async () => {
    const user = userEvent.setup();
    render(
      <>
        <BrandedConversationStarters />
        <textarea id="prompt-textarea" aria-label="Composer" />
      </>,
    );

    const firstStarter = screen.getAllByRole('button')[0];
    firstStarter.focus();
    await user.keyboard('{Enter}');

    expect(mockSetValue).toHaveBeenCalledWith('text', translations.com_ui_home_starter_summarize, {
      shouldDirty: true,
      shouldValidate: true,
    });
    expect(screen.getByRole('textbox', { name: 'Composer' })).toHaveFocus();
  });
});
