import { modals } from '@mantine/modals'
import type { BulkAcceptModalProps } from './BulkAcceptModal'
import { BulkAcceptModal } from './BulkAcceptModal'

export type BulkAcceptModalArgs = Omit<BulkAcceptModalProps, 'onRequestClose'>

export default function openBulkAcceptModal(args: BulkAcceptModalArgs) {
  const modalId = modals.open({
    title: t('Accept all selected'),
    size: 'lg',
    children: (
      <BulkAcceptModal
        onRequestClose={() => {
          modals.close(modalId)
        }}
        {...args}
      />
    ),
  })
}
