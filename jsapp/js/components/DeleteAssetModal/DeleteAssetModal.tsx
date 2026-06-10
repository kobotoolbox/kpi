import React from 'react'

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
  modalId: string
  onRequestClose: () => void
}

export function DeleteAssetModal(props: DeleteAssetModalProps) {
  const assetTypeLabel = ASSET_TYPES[props.asset.asset_type].label
  const [isDataChecked, setIsDataChecked] = React.useState(false)
  const [isFormChecked, setIsFormChecked] = React.useState(false)
  const [isRecoverChecked, setIsRecoverChecked] = React.useState(false)
  const [isConfirmDeletePending, setIsConfirmDeletePending] = React.useState(false)

  React.useEffect(() => {
    modals.updateModal({
      modalId: props.modalId,
      closeOnEscape: !isConfirmDeletePending,
      closeOnClickOutside: !isConfirmDeletePending,
    })
  }, [isConfirmDeletePending, props.modalId])

  function onConfirmDelete() {
    setIsConfirmDeletePending(true)

    deleteAsset(
      props.asset,
      props.name,
      (deletedAssetUid: string) => {
        props.onRequestClose()
        props.onDeleted?.(deletedAssetUid)
      },
      () => {
        setIsConfirmDeletePending(false)
      },
    )
  }

  const isDeployed = props.asset.has_deployment
  const shouldConfirmDataDeletion = isDeployed && props.asset.deployment__submission_count !== 0
  const shouldRequireConfirmation = isDeployed
  const isConfirmDisabled =
    shouldRequireConfirmation && ((shouldConfirmDataDeletion && !isDataChecked) || !isFormChecked || !isRecoverChecked)

  let promptContent: React.ReactNode

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
  } else if (props.asset.asset_type !== ASSET_TYPES.survey.id) {
    promptContent = <Text>{t('You are about to permanently delete this item from your library.')}</Text>
  } else {
    promptContent = <Text>{t('You are about to permanently delete this draft.')}</Text>
  }

  return (
    <Stack gap='md'>
      {promptContent}

      <Group justify='flex-end' mt='lg'>
        <ButtonNew variant='light' size='md' onClick={props.onRequestClose} disabled={isConfirmDeletePending}>
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
