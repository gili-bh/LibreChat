import { memo } from 'react';
import type { TConversation, TEndpointsConfig } from 'librechat-data-provider';
import { useAgentsMapContext, useAssistantsMapContext } from '~/Providers';
import EndpointIcon from '~/components/Endpoints/EndpointIcon';
import { areConversationIconFieldsEqual } from './utils';
import { useGetEndpointsQuery } from '~/data-provider';
import { useAdminInterface } from '~/hooks';
import { cn } from '~/utils';

const emptyEndpointsConfig = {} as TEndpointsConfig;

type EndpointIconContext = 'message' | 'nav' | 'landing' | 'menu-item';

type ConversationEndpointIconProps = {
  conversation: TConversation;
  className?: string;
  context?: EndpointIconContext;
  size?: number;
};

function ConversationEndpointIcon({
  conversation,
  className,
  context = 'menu-item',
  size = 20,
}: ConversationEndpointIconProps) {
  const showAdvancedInterface = useAdminInterface();
  const { data: endpointsConfig = emptyEndpointsConfig } = useGetEndpointsQuery();
  const agentsMap = useAgentsMapContext();
  const assistantMap = useAssistantsMapContext();

  if (!showAdvancedInterface) {
    return (
      <img
        src="assets/branding/icon-192x192.png"
        alt=""
        aria-hidden="true"
        className={cn('shrink-0 rounded-full object-contain', className)}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <EndpointIcon
      conversation={conversation}
      endpointsConfig={endpointsConfig}
      assistantMap={assistantMap}
      agentsMap={agentsMap}
      className={className}
      size={size}
      context={context}
    />
  );
}

export default memo(ConversationEndpointIcon, (prevProps, nextProps) => {
  return (
    prevProps.className === nextProps.className &&
    prevProps.context === nextProps.context &&
    prevProps.size === nextProps.size &&
    areConversationIconFieldsEqual(prevProps.conversation, nextProps.conversation)
  );
});
