import { Group, Stack, Text } from '@mantine/core'
import { modals } from '@mantine/modals'
import { useEffect, useState } from 'react'
import { useAssetsExportSettingsDestroy } from '#/api/react-query/survey-data'
import ButtonNew from '#/components/common/ButtonNew'
import { notify } from '#/utils'

export interface DeleteExportSettingModalProps {
  assetUid: string
  exportSettingUid: string
  exportSettingName: string
  onDeleted?: () => void
  modalId: string
  onRequestClose: () => void
}

export function DeleteExportSettingModal({
  assetUid,
  exportSettingUid,
  exportSettingName,
  onDeleted,
  modalId,
  onRequestClose,
}: DeleteExportSettingModalProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const deleteExportSettingMutation = useAssetsExportSettingsDestroy()

  useEffect(() => {
    // Prevent closing while the delete request is being processed
    modals.updateModal({
      modalId,
      withCloseButton: !isDeleting,
      closeOnEscape: !isDeleting,
      closeOnClickOutside: !isDeleting,
    })
  }, [isDeleting, modalId])

  async function onConfirmDelete() {
    setIsDeleting(true)

    try {
      await deleteExportSettingMutation.mutateAsync({
        uidAsset: assetUid,
        uidExportSetting: exportSettingUid,
      })
      onRequestClose()
      onDeleted?.()
    } catch {
      notify(t('Failed to delete export setting'), 'error')
      setIsDeleting(false)
    }
  }

  return (
    <Stack gap='md'>
      <Text>
        {t('Are you sure you want to delete the export settings "##NAME##"? This action is not reversible.').replace(
          '##NAME##',
          exportSettingName,
        )}
      </Text>

      <Group justify='flex-end' mt='lg'>
        <ButtonNew variant='light' size='md' onClick={onRequestClose} disabled={isDeleting}>
          {t('Cancel')}
        </ButtonNew>
        <ButtonNew variant='danger' size='md' onClick={onConfirmDelete} loading={isDeleting}>
          {t('Delete')}
        </ButtonNew>
      </Group>
    </Stack>
  )
}
