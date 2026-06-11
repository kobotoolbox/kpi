import { modals } from '@mantine/modals'
import { generateUuid } from '#/utils'
import { BulkDeleteModal } from './BulkDeleteModal'

/**
 * Opens the bulk delete confirmation modal and returns imperative close helpers.
 */
export function openBulkDeleteModal(assetUids: string[]) {
  const modalId = `bulk-delete-${generateUuid()}`

  modals.open({
    modalId,
    title: t('Delete ##count## projects').replace('##count##', String(assetUids.length)),
    size: 'md',
    children: <BulkDeleteModal assetUids={assetUids} modalId={modalId} onRequestClose={() => modals.close(modalId)} />,
  })

  return {
    modalId,
    close: () => modals.close(modalId),
  }
}
