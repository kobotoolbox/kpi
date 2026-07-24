import { modals } from '@mantine/modals'
import { generateUuid } from '#/utils'
import { DeleteExportSettingModal } from './DeleteExportSettingModal'

export function openDeleteExportSettingModal(
  assetUid: string,
  exportSettingUid: string,
  exportSettingName: string,
  onDeleted?: () => void,
) {
  const modalId = `delete-export-setting-${generateUuid()}`

  modals.open({
    modalId,
    title: t('Delete export settings?'),
    size: 'md',
    children: (
      <DeleteExportSettingModal
        assetUid={assetUid}
        exportSettingUid={exportSettingUid}
        exportSettingName={exportSettingName}
        onDeleted={onDeleted}
        modalId={modalId}
        onRequestClose={() => modals.close(modalId)}
      />
    ),
  })

  return {
    modalId,
    close: () => modals.close(modalId),
  }
}
