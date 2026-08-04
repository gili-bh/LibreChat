import { FileText, Mail, SearchCheck } from 'lucide-react';
import type { TranslationKeys } from '~/hooks';
import { useChatFormContext } from '~/Providers';
import { mainTextareaId } from '~/common';
import { useLocalize } from '~/hooks';

const starters: ReadonlyArray<{
  titleKey: TranslationKeys;
  descriptionKey: TranslationKeys;
  icon: typeof FileText;
}> = [
  {
    titleKey: 'com_ui_home_starter_summarize',
    descriptionKey: 'com_ui_home_starter_summarize_description',
    icon: FileText,
  },
  {
    titleKey: 'com_ui_home_starter_email',
    descriptionKey: 'com_ui_home_starter_email_description',
    icon: Mail,
  },
  {
    titleKey: 'com_ui_home_starter_analyze',
    descriptionKey: 'com_ui_home_starter_analyze_description',
    icon: SearchCheck,
  },
];

export default function BrandedConversationStarters() {
  const localize = useLocalize();
  const methods = useChatFormContext();

  const insertStarter = (titleKey: TranslationKeys) => {
    methods.setValue('text', localize(titleKey), {
      shouldDirty: true,
      shouldValidate: true,
    });
    document.getElementById(mainTextareaId)?.focus();
  };

  return (
    <div className="mb-4 grid w-full grid-cols-1 gap-2 px-3 sm:grid-cols-3 sm:px-2">
      {starters.map(({ titleKey, descriptionKey, icon: Icon }) => (
        <button
          key={titleKey}
          type="button"
          aria-label={localize(titleKey)}
          onClick={() => insertStarter(titleKey)}
          className="group grid min-h-24 w-full grid-cols-[auto_1fr] items-start gap-3 rounded-lg border border-border-light bg-surface-primary p-3 text-start shadow-sm transition-colors hover:border-brand-primary hover:bg-surface-primary-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary disabled:pointer-events-none disabled:opacity-50"
        >
          <span className="flex size-8 items-center justify-center rounded-md bg-surface-active text-brand-link transition-colors group-hover:text-brand-primary">
            <Icon className="size-4" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium text-text-primary">
              {localize(titleKey)}
            </span>
            <span className="mt-1 block text-xs leading-5 text-text-secondary">
              {localize(descriptionKey)}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}
