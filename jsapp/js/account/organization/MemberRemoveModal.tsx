// Partial components
import Button from 'jsapp/js/components/common/button';
import InlineMessage from 'jsapp/js/components/common/inlineMessage';
import KoboModal from 'jsapp/js/components/modals/koboModal';
import KoboModalHeader from 'jsapp/js/components/modals/koboModalHeader';
import KoboModalContent from 'jsapp/js/components/modals/koboModalContent';
import KoboModalFooter from 'jsapp/js/components/modals/koboModalFooter';

// Stores, hooks and utilities
// TODO import the thing for getting team/org label

interface MemberRemoveModalProps {
  username: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * A confirmation prompt modal for removing a user from organization. Displays
 * two buttons and warning message.
 */
export default function MemberRemoveModal(
  {username, onConfirm, onCancel}: MemberRemoveModalProps
) {
  return (
    <KoboModal
      // It's always open, to hide it just don't render it at parent level
      isOpen
      size='medium'
      onRequestClose={() => onCancel()}
    >
      <KoboModalHeader>
        {
          t('Remove ##username## from this ##team or org##')
            .replace('##username##', username)
            .replace('##team or org##', 'TODO')
        }
      </KoboModalHeader>

      <KoboModalContent>
        <p>{
          t('Are you sure you want to remove ##username## from UNHCR Turkey?')
            .replace('##username##', username)
        }</p>

        <InlineMessage
          type='info'
          icon='information'
          message={t('Removing them from this team also means they will immediately lose access to any projects owned by your team.')}
        />
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
          label={t('Remove member')}
        />
      </KoboModalFooter>
    </KoboModal>
  );
}
