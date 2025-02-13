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
import {useRemoveOrganizationMember} from './membersQuery';
import {notify} from 'alertifyjs';

interface MemberRemoveModalProps {
  username: string;
  isRemovingSelf: boolean;
  onConfirmDone: () => void;
  onCancel: () => void;
}

/**
 * A confirmation prompt modal for removing a user from organization. Displays
 * two buttons and warning message.
 *
 * Note: it's always open - if you need to hide it, just don't render it at
 * the parent level.
 */
export default function MemberRemoveModal(
  {
    username,
    isRemovingSelf,
    onConfirmDone,
    onCancel,
  }: MemberRemoveModalProps
) {
  const removeMember = useRemoveOrganizationMember();
  const mmoLabel = getSimpleMMOLabel(
    envStore.data,
    subscriptionStore.activeSubscriptions[0],
    false,
    false
  );

  // There are two different sets of strings - one for removing a member, and
  // one for leaving the organization.
  const REMOVE_MEMBER_TEXT = {
    title: t('Remove ##username## from this ##TEAM_OR_ORGANIZATION##'),
    description: t('Are you sure you want to remove ##username## from this ##TEAM_OR_ORGANIZATION##?'),
    dangerMessage: t('Removing them from this ##TEAM_OR_ORGANIZATION## also means they will immediately lose access to any projects owned by your ##TEAM_OR_ORGANIZATION##. This action cannot be undone.'),
    confirmButtonLabel: t('Remove member'),
  };
  const REMOVE_SELF_TEXT = {
    title: t('Leave this ##TEAM_OR_ORGANIZATION##'),
    description: t('Are you sure you want to leave this ##TEAM_OR_ORGANIZATION##?'),
    dangerMessage: t('You will immediately lose access to any projects owned by this ##TEAM_OR_ORGANIZATION##. This action cannot be undone.'),
    confirmButtonLabel: t('Leave ##TEAM_OR_ORGANIZATION##'),
  };
  const textToDisplay = isRemovingSelf ? REMOVE_SELF_TEXT : REMOVE_MEMBER_TEXT;
  // Replace placeholders with proper strings in chosen set:
  for (const key in textToDisplay) {
    const keyCast = key as keyof typeof textToDisplay;
    textToDisplay[keyCast] = textToDisplay[keyCast]
      .replaceAll('##username##', username)
      .replaceAll('##TEAM_OR_ORGANIZATION##', mmoLabel);
  }

  const handleRemoveMember = async () => {
    try {
      await removeMember.mutateAsync(username);
    } catch (error) {
      notify('Failed to remove member', 'error');
    } finally {
      onConfirmDone();
    }
  };

  return (
    <KoboModal isOpen size='medium' onRequestClose={() => onCancel()}>
      <KoboModalHeader>{textToDisplay.title}</KoboModalHeader>

      <KoboModalContent>
        <p>{textToDisplay.description}</p>

        <InlineMessage type='error' icon='alert' message={textToDisplay.dangerMessage}/>
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
          onClick={handleRemoveMember}
          label={textToDisplay.confirmButtonLabel}
          isPending={removeMember.isPending}
        />
      </KoboModalFooter>
    </KoboModal>
  );
}
