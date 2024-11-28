// Partial components
import Button from 'jsapp/js/components/common/button';
import InlineMessage from 'jsapp/js/components/common/inlineMessage';
import KoboModal from 'jsapp/js/components/modals/koboModal';
import KoboModalHeader from 'jsapp/js/components/modals/koboModalHeader';
import KoboModalContent from 'jsapp/js/components/modals/koboModalContent';
import KoboModalFooter from 'jsapp/js/components/modals/koboModalFooter';

// Stores, hooks and utilities
import {getSimpleMMOLabel} from './organization.utils';
import envStore from 'jsapp/js/envStore';
import subscriptionStore from 'jsapp/js/account/subscriptionStore';

export const REMOVE_SELF_TEXT = {
  title: t('Leave this ##team/org##'),
  description: t('Are you sure you want to leave this ##team/org##?'),
  dangerMessage: t('You will immediately lose access to any projects owned by this ##team/org##. This action cannot be undone.'),
  confirmButtonLabel: t('Leave ##team/org##'),
};

export const REMOVE_MEMBER_TEXT = {
  title: t('Remove ##username## from this ##team/org##'),
  description: t('Are you sure you want to remove ##username## from this ##team/org##?'),
  dangerMessage: t('Removing them from this ##team/org## also means they will immediately lose access to any projects owned by your ##team/org##. This action cannot be undone.'),
  confirmButtonLabel: t('Remove member'),
};

/**
   * Replaces placeholders with values, assumes all placeholders want to be
   * lowercase.
   */
function replacePlaceholders(text: string, username: string, mmoLabel: string) {
  return text
    .replaceAll('##username##', username)
    .replaceAll('##team/org##', mmoLabel);
}

interface MemberRemoveModalProps {
  username: string;
  isRemovingSelf: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * A confirmation prompt modal for removing a user from organization. Displays
 * two buttons and warning message.
 */
export default function MemberRemoveModal(
  {
    username,
    isRemovingSelf,
    onConfirm,
    onCancel
  }: MemberRemoveModalProps
) {
  const mmoLabel = getSimpleMMOLabel(
    envStore.data,
    subscriptionStore.activeSubscriptions[0],
    false,
    false
  );

  // Choose proper text
  let title = isRemovingSelf ? REMOVE_SELF_TEXT.title : REMOVE_MEMBER_TEXT.title;
  let description = isRemovingSelf ? REMOVE_SELF_TEXT.description : REMOVE_MEMBER_TEXT.description;
  let dangerMessage = isRemovingSelf ? REMOVE_SELF_TEXT.dangerMessage : REMOVE_MEMBER_TEXT.dangerMessage;
  let confirmButtonLabel = isRemovingSelf ? REMOVE_SELF_TEXT.confirmButtonLabel : REMOVE_MEMBER_TEXT.confirmButtonLabel;

  // Replace placeholders with proper strings
  title = replacePlaceholders(title, username, mmoLabel);
  description = replacePlaceholders(description, username, mmoLabel);
  dangerMessage = replacePlaceholders(dangerMessage, username, mmoLabel);
  confirmButtonLabel = replacePlaceholders(confirmButtonLabel, username, mmoLabel);

  return (
    <KoboModal
      // It's always open, to hide it just don't render it at parent level
      isOpen
      size='medium'
      onRequestClose={() => onCancel()}
    >
      <KoboModalHeader>{title}</KoboModalHeader>

      <KoboModalContent>
        <p>{description}</p>

        <InlineMessage type='error' icon='alert' message={dangerMessage}/>
      </KoboModalContent>

      <KoboModalFooter>
        <Button
          type='secondary'
          size='m'
          onClick={onCancel}
          label={t('Cancel')}
        />

        <Button
          type='danger'
          size='m'
          onClick={onConfirm}
          label={confirmButtonLabel}
        />
      </KoboModalFooter>
    </KoboModal>
  );
}
