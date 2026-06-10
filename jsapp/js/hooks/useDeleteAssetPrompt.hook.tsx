import React, { useCallback, useState } from 'react'

import { Group, Stack, Text } from '@mantine/core'
import { deleteAsset } from '#/assetQuickActions'
import ButtonNew from '#/components/common/ButtonNew'
import ModalNew from '#/components/common/ModalNew'
import Checkbox from '#/components/common/checkbox'
import { ASSET_TYPES } from '#/constants'
import type { AssetResponse, ProjectViewAsset } from '#/dataInterface'

export type OpenDeleteAssetPrompt = (
  asset: AssetResponse | ProjectViewAsset,
  name: string,
  onDeleted?: (deletedAssetUid: string) => void,
) => void

interface PromptRequest {
  asset: AssetResponse | ProjectViewAsset
  name: string
  onDeleted?: (deletedAssetUid: string) => void
}

interface DeleteAssetPromptProps {
  asset: AssetResponse | ProjectViewAsset
  name: string
  isOpen: boolean
  onRequestClose: () => void
  onDeleted?: (deletedAssetUid: string) => void
}

function DeleteAssetPrompt(props: DeleteAssetPromptProps) {
  const assetTypeLabel = ASSET_TYPES[props.asset.asset_type].label
  const [isDataChecked, setIsDataChecked] = useState(false)
  const [isFormChecked, setIsFormChecked] = useState(false)
  const [isRecoverChecked, setIsRecoverChecked] = useState(false)
  const [isConfirmDeletePending, setIsConfirmDeletePending] = useState(false)

  function onConfirmDelete() {
    setIsConfirmDeletePending(true)

    deleteAsset(
      props.asset,
      props.name,
      (deletedAssetUid: string) => {
        if (typeof props.onDeleted === 'function') {
          props.onDeleted(deletedAssetUid)
        }
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
    <ModalNew
      opened={props.isOpen}
      onClose={props.onRequestClose}
      closeOnEscape={!isConfirmDeletePending}
      closeOnClickOutside={!isConfirmDeletePending}
      withCloseButton
      title={t('Delete ##ASSET_TYPE## "##NAME##"')
        .replace('##ASSET_TYPE##', assetTypeLabel)
        .replace('##NAME##', props.name)}
      size='md'
    >
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
    </ModalNew>
  )
}

export function useDeleteAssetPrompt() {
  const [promptRequest, setPromptRequest] = useState<PromptRequest | null>(null)

  const handleClosePrompt = useCallback(() => {
    setPromptRequest(null)
  }, [])

  const handleOpenPrompt = useCallback<OpenDeleteAssetPrompt>((asset, name, onDeleted) => {
    setPromptRequest({ asset, name, onDeleted })
  }, [])

  const deleteAssetPrompt = promptRequest ? (
    <DeleteAssetPrompt
      asset={promptRequest.asset}
      name={promptRequest.name}
      isOpen
      onRequestClose={handleClosePrompt}
      onDeleted={(deletedAssetUid: string) => {
        promptRequest.onDeleted?.(deletedAssetUid)
        handleClosePrompt()
      }}
    />
  ) : null

  return {
    openDeleteAssetPrompt: handleOpenPrompt,
    closeDeleteAssetPrompt: handleClosePrompt,
    deleteAssetPrompt,
  }
}

interface DeleteAssetPromptHookBridgeProps {
  onReady: (openDeleteAssetPrompt: OpenDeleteAssetPrompt) => void
}

export function DeleteAssetPromptHookBridge(props: DeleteAssetPromptHookBridgeProps) {
  const { openDeleteAssetPrompt, deleteAssetPrompt } = useDeleteAssetPrompt()

  React.useEffect(() => {
    props.onReady(openDeleteAssetPrompt)
  }, [openDeleteAssetPrompt, props.onReady])

  return <>{deleteAssetPrompt}</>
}
