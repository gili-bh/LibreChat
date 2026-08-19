import { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { easings } from '@react-spring/web';
import { EModelEndpoint } from 'librechat-data-provider';
import { BirthdayIcon, TooltipAnchor, SplitText } from '@librechat/client';
import {
  getIconEndpoint,
  getEntity,
  createConfigHtmlSanitizer,
  CONFIG_HTML_MEDIA_TAGS,
  CONFIG_HTML_MEDIA_ATTR,
} from '~/utils';
import { useChatContext, useAgentsMapContext, useAssistantsMapContext } from '~/Providers';
import { useGetEndpointsQuery, useGetStartupConfig } from '~/data-provider';
import AgentContact from '~/components/Agents/AgentContact';
import ConvoIcon from '~/components/Endpoints/ConvoIcon';
import { useLocalize, useAuthContext } from '~/hooks';

const containerClassName =
  'shadow-stroke relative flex h-full items-center justify-center rounded-full bg-white dark:bg-presentation dark:text-white text-black dark:after:shadow-none ';

/** Stable references: fresh literals re-initialized SplitText's springs and
 * re-rendered every grapheme span on each Landing render. */
const greetingAnimationFrom = { opacity: 0, transform: 'translate3d(0,50px,0)' };
const greetingAnimationTo = { opacity: 1, transform: 'translate3d(0,0,0)' };
const userNamePlaceholder = '__USER_NAME_PLACEHOLDER__';

function getTextSizeClass(text: string | undefined | null) {
  if (!text) {
    return 'text-xl sm:text-2xl';
  }

  if (text.length < 40) {
    return 'text-2xl sm:text-4xl';
  }

  if (text.length < 70) {
    return 'text-xl sm:text-2xl';
  }

  return 'text-lg sm:text-md';
}

export default function Landing({ centerFormOnLanding }: { centerFormOnLanding: boolean }) {
  const { conversation } = useChatContext();
  const agentsMap = useAgentsMapContext();
  const assistantMap = useAssistantsMapContext();
  const { data: startupConfig } = useGetStartupConfig();
  const { data: endpointsConfig } = useGetEndpointsQuery();
  const { user } = useAuthContext();
  const localize = useLocalize();

  const [textHasMultipleLines, setTextHasMultipleLines] = useState(false);
  const [lineCount, setLineCount] = useState(1);
  const [contentHeight, setContentHeight] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  const endpointType = useMemo(() => {
    let ep = conversation?.endpoint ?? '';
    if (ep === EModelEndpoint.azureOpenAI) {
      ep = EModelEndpoint.openAI;
    }
    return getIconEndpoint({
      endpointsConfig,
      iconURL: conversation?.iconURL,
      endpoint: ep,
    });
  }, [conversation?.endpoint, conversation?.iconURL, endpointsConfig]);

  const { entity, isAgent, isAssistant } = getEntity({
    endpoint: endpointType,
    agentsMap,
    assistantMap,
    agent_id: conversation?.agent_id,
    assistant_id: conversation?.assistant_id,
  });

  const name = entity?.name ?? '';
  const isBrandedLanding = !entity;
  const userDisplayName = user?.name?.trim() || user?.username?.trim() || localize('com_nav_user');
  const greetingTemplate = localize('com_ui_branded_home_welcome', {
    name: userNamePlaceholder,
  });
  const userNameIndex = greetingTemplate.indexOf(userNamePlaceholder);
  const greetingBeforeName = greetingTemplate.slice(0, userNameIndex);
  const greetingAfterName = greetingTemplate.slice(userNameIndex + userNamePlaceholder.length);
  const description = isBrandedLanding
    ? localize('com_ui_branded_home_description')
    : ((entity?.description || conversation?.greeting) ?? '');
  const descriptionIsHTML = !isBrandedLanding && description.trim().startsWith('<');

  const sanitizeDescription = useMemo(
    () =>
      createConfigHtmlSanitizer({
        allowedTags: CONFIG_HTML_MEDIA_TAGS,
        allowedAttr: CONFIG_HTML_MEDIA_ATTR,
      }),
    [],
  );
  const selectedAgent =
    isAgent && conversation?.agent_id != null ? agentsMap?.[conversation.agent_id] : undefined;

  const handleLineCountChange = useCallback((count: number) => {
    setTextHasMultipleLines(count > 1);
    setLineCount(count);
  }, []);

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.offsetHeight);
    }
  }, [lineCount, description, selectedAgent]);

  const getDynamicMargin = useMemo(() => {
    let margin = 'mb-0';

    if (lineCount > 2 || (description && description.length > 100)) {
      margin = 'mb-10';
    } else if (lineCount > 1 || (description && description.length > 0)) {
      margin = 'mb-6';
    } else if (textHasMultipleLines) {
      margin = 'mb-4';
    }

    if (contentHeight > 200) {
      margin = 'mb-16';
    } else if (contentHeight > 150) {
      margin = 'mb-12';
    }

    return margin;
  }, [lineCount, description, textHasMultipleLines, contentHeight]);

  return (
    <div
      className={`flex h-full transform-gpu flex-col items-center justify-center pb-16 transition-all duration-200 ${centerFormOnLanding ? 'max-h-full sm:max-h-0' : 'max-h-full'} ${getDynamicMargin}`}
    >
      <div ref={contentRef} className="flex flex-col items-center gap-0 p-2">
        <div
          className={`flex ${isBrandedLanding || textHasMultipleLines ? 'flex-col' : 'flex-col md:flex-row'} items-center justify-center gap-2`}
        >
          <div
            className={
              isBrandedLanding
                ? 'relative mb-3 flex h-14 w-full max-w-64 items-center justify-center sm:h-16'
                : `relative size-10 justify-center ${textHasMultipleLines ? 'mb-2' : ''}`
            }
          >
            {isBrandedLanding ? (
              <img
                src="assets/branding/logo.svg"
                className="h-full w-auto max-w-full object-contain"
                alt={localize('com_ui_logo', { 0: startupConfig?.appTitle ?? '' })}
              />
            ) : (
              <ConvoIcon
                agentsMap={agentsMap}
                assistantMap={assistantMap}
                conversation={conversation}
                endpointsConfig={endpointsConfig}
                containerClassName={containerClassName}
                context="landing"
                className="h-2/3 w-2/3 text-black dark:text-white"
                size={41}
              />
            )}
            {startupConfig?.showBirthdayIcon && (
              <TooltipAnchor
                className="absolute bottom-[27px] right-2"
                description={localize('com_ui_happy_birthday')}
                aria-label={localize('com_ui_happy_birthday')}
              >
                <BirthdayIcon />
              </TooltipAnchor>
            )}
          </div>
          {((isAgent || isAssistant) && name) || name ? (
            <div className="flex flex-col items-center gap-0 p-2">
              <SplitText
                key={`split-text-${name}`}
                text={name}
                className={`${getTextSizeClass(name)} font-medium text-text-primary`}
                delay={50}
                textAlign="center"
                animationFrom={greetingAnimationFrom}
                animationTo={greetingAnimationTo}
                easing={easings.easeOutCubic}
                threshold={0}
                rootMargin="0px"
                onLineCountChange={handleLineCountChange}
              />
            </div>
          ) : (
            <p
              dir="rtl"
              className="animate-fadeIn text-center text-xl font-medium text-text-primary sm:text-2xl"
            >
              {greetingBeforeName}
              <bdi
                dir="ltr"
                data-direction="ltr"
                data-testid="branded-greeting-user-name"
                className="inline-block"
                style={{
                  direction: 'ltr',
                  unicodeBidi: 'isolate',
                  display: 'inline-block',
                  textAlign: 'left',
                }}
              >
                {userDisplayName}
              </bdi>
              {greetingAfterName}
            </p>
          )}
        </div>
        {description &&
          (descriptionIsHTML ? (
            <div
              className="animate-fadeIn mt-4 flex max-w-md items-center justify-center gap-2 text-center text-sm font-normal text-text-primary [&_img]:inline-block [&_img]:h-4 [&_img]:w-4"
              dangerouslySetInnerHTML={{ __html: sanitizeDescription(description) }}
            />
          ) : (
            <div className="animate-fadeIn mt-4 max-w-md text-center text-sm font-normal text-text-primary">
              {description}
            </div>
          ))}
        {selectedAgent && (
          <AgentContact
            agent={selectedAgent}
            className="animate-fadeIn mt-2 max-w-md justify-center text-center text-sm"
          />
        )}
      </div>
    </div>
  );
}
