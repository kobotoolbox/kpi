import { modals } from '@mantine/modals'
import { generateUuid } from '#/utils'
import { DeleteExportModal } from './DeleteExportModal'

export function openDeleteExportModal(onConfirm: () => void) {
  const modalId = `delete-export-${generateUuid()}`

  modals.open({
    modalId,
    title: t('Delete export?'),
    size: 'md',
    children: (
      <DeleteExportModal
        onConfirm={() => {
          modals.close(modalId)
          onConfirm()
        }}
        onCancel={() => modals.close(modalId)}
      />
    ),
  })

  return {
    modalId,
    close: () => modals.close(modalId),
  }
}
