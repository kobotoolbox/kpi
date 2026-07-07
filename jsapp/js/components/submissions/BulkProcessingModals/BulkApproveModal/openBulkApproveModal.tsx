import { modals } from '@mantine/modals'
import type { BulkApproveModalProps } from './BulkApproveModal'
import { BulkApproveModal } from './BulkApproveModal'

export type BulkApproveModalArgs = Omit<BulkApproveModalProps, 'onRequestClose'>

export default function openBulkApproveModal(args: BulkApproveModalArgs) {
  const modalId = modals.open({
    title: t('Approve all selected'),
    size: 'lg',
    children: (
      <BulkApproveModal
        onRequestClose={() => {
          modals.close(modalId)
        }}
        {...args}
      />
    ),
  })
}
