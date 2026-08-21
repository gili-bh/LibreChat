import type { TranslationKeys } from '~/hooks';
import { useLocalize } from '~/hooks';

const placeholderKeys: ReadonlyArray<TranslationKeys> = [
  'com_endpoint_message_new_prefix',
  'com_endpoint_message_new_product',
  'com_endpoint_message_new_suffix',
];

export function getBrandedComposerPlaceholder(localize: (key: TranslationKeys) => string) {
  return placeholderKeys.map((key) => localize(key)).join('');
}

export default function BrandedComposerPlaceholder() {
  const localize = useLocalize();

  return (
    <span
      aria-hidden="true"
      dir="rtl"
      data-testid="branded-composer-placeholder"
      className="pointer-events-none absolute inset-x-0 top-0 overflow-hidden whitespace-nowrap px-5 py-[13px] text-black/60 dark:text-white/60 md:py-3.5"
    >
      {localize('com_endpoint_message_new_prefix')}
      <bdi
        dir="ltr"
        data-direction="ltr"
        data-testid="branded-composer-product-name"
        className="inline-block"
        style={{ direction: 'ltr', unicodeBidi: 'isolate' }}
      >
        {localize('com_endpoint_message_new_product')}
      </bdi>
      {localize('com_endpoint_message_new_suffix')}
    </span>
  );
}
