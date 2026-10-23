import { modals } from '@mantine/modals'
import TransferTeamOwnershipModal from './TransferTeamOwnershipModal'

interface OpenTransferTeamOwnershipModalOptions {
  username: string
  targetFullName?: string | null
  orgName?: string
}

/** Opens the transfer team ownership confirmation in a Mantine modal. */
export function openTransferTeamOwnershipModal(options: OpenTransferTeamOwnershipModalOptions) {
  const modalId = modals.open({
    title: t('Transfer ownership'),
    size: 'lg',
    children: (
      <TransferTeamOwnershipModal
        username={options.username}
        targetFullName={options.targetFullName}
        orgName={options.orgName}
        onCancel={() => modals.close(modalId)}
        onConfirm={() => modals.close(modalId)}
      />
    ),
  })

  return {
    modalId,
    close: () => modals.close(modalId),
  }
}
