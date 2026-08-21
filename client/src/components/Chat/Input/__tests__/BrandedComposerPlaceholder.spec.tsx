import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import BrandedComposerPlaceholder, {
  getBrandedComposerPlaceholder,
} from '../BrandedComposerPlaceholder';

const translations: Record<string, string> = {
  com_endpoint_message_new_prefix: 'יש לך שאלה ל-',
  com_endpoint_message_new_product: 'LE AI',
  com_endpoint_message_new_suffix: '?...',
};

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) => translations[key] ?? key,
}));

describe('BrandedComposerPlaceholder', () => {
  it('isolates the English product name inside the RTL placeholder', () => {
    render(<BrandedComposerPlaceholder />);

    const placeholder = screen.getByTestId('branded-composer-placeholder');
    const productName = screen.getByTestId('branded-composer-product-name');

    expect(placeholder).toHaveAttribute('dir', 'rtl');
    expect(placeholder.textContent).toBe('יש לך שאלה ל-LE AI?...');
    expect(productName.textContent).toBe('LE AI');
    expect(productName).toHaveAttribute('dir', 'ltr');
    expect(productName).toHaveAttribute('data-direction', 'ltr');
    expect(productName).toHaveStyle({ direction: 'ltr', unicodeBidi: 'isolate' });
  });

  it('provides the same literal text for the textarea accessibility metadata', () => {
    expect(getBrandedComposerPlaceholder((key) => translations[key] ?? key)).toBe(
      'יש לך שאלה ל-LE AI?...',
    );
  });
});
