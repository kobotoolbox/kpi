import { type ReactNode, useEffect, useState } from 'react'

import { Group, Stack, Text } from '@mantine/core'
import { modals } from '@mantine/modals'
import { deleteAsset } from '#/assetQuickActions'
import ButtonNew from '#/components/common/ButtonNew'
import Checkbox from '#/components/common/checkbox'
import { ASSET_TYPES } from '#/constants'
import type { AssetResponse, ProjectViewAsset } from '#/dataInterface'

export interface DeleteAssetModalProps {
  asset: AssetResponse | ProjectViewAsset
  name: string
  onDeleted?: (deletedAssetUid: string) => void
  onFailed?: () => void
  modalId: string
  onRequestClose: () => void
}

export function DeleteAssetModal({ asset, name, onDeleted, onFailed, modalId, onRequestClose }: DeleteAssetModalProps) {
  const assetTypeLabel = ASSET_TYPES[asset.asset_type].label
  const [isDataChecked, setIsDataChecked] = useState(false)
  const [isFormChecked, setIsFormChecked] = useState(false)
  const [isRecoverChecked, setIsRecoverChecked] = useState(false)
  const [isConfirmDeletePending, setIsConfirmDeletePending] = useState(false)

  useEffect(() => {
    // Updates the modal to prevent closing while the delete request is being processed
    modals.updateModal({
      modalId,
      withCloseButton: !isConfirmDeletePending,
      closeOnEscape: !isConfirmDeletePending,
      closeOnClickOutside: !isConfirmDeletePending,
    })
  }, [isConfirmDeletePending, modalId])

  function onConfirmDelete() {
    setIsConfirmDeletePending(true)

    deleteAsset(
      asset,
      name,
      (deletedAssetUid: string) => {
        onRequestClose()
        onDeleted?.(deletedAssetUid)
      },
      () => {
        setIsConfirmDeletePending(false)
        onFailed?.()
        onRequestClose()
      },
    )
  }

  const isDeployed = asset.has_deployment
  const shouldConfirmDataDeletion = isDeployed && asset.deployment__submission_count !== 0
  const shouldRequireConfirmation = isDeployed
  const isConfirmDisabled =
    shouldRequireConfirmation && ((shouldConfirmDataDeletion && !isDataChecked) || !isFormChecked || !isRecoverChecked)

  let promptContent: ReactNode

  if (isDeployed) {
    promptContent = (
      <>
        <Text>{t('You are about to permanently delete this form.')}</Text>

        {shouldConfirmDataDeletion && (
          <Checkbox
            checked={isDataChecked}
            onChange={setIsDataChecked}
            label={t('All data gathered for this form will be deleted.')}
          />
        )}

        <Checkbox
          checked={isFormChecked}
          onChange={setIsFormChecked}
          label={t('The form associated with this project will be deleted.')}
        />

        <strong>
          <Checkbox
            checked={isRecoverChecked}
            onChange={setIsRecoverChecked}
            label={t('I understand that if I delete this project I will not be able to recover it.')}
          />
        </strong>
      </>
    )
  } else if (asset.asset_type !== ASSET_TYPES.survey.id) {
    promptContent = <Text>{t('You are about to permanently delete this item from your library.')}</Text>
  } else {
    promptContent = <Text>{t('You are about to permanently delete this draft.')}</Text>
  }

  return (
    <Stack gap='md'>
      {promptContent}

      <Group justify='flex-end' mt='lg'>
        <ButtonNew variant='light' size='md' onClick={onRequestClose} disabled={isConfirmDeletePending}>
          {t('Cancel')}
        </ButtonNew>
        <ButtonNew
          variant='danger'
          size='md'
          onClick={onConfirmDelete}
          disabled={isConfirmDisabled}
          loading={isConfirmDeletePending}
        >
          {t('Delete')}
        </ButtonNew>
      </Group>
    </Stack>
  )
}
