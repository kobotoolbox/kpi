import React from 'react'

import { Stack, Text } from '@mantine/core'
import { deleteAsset } from '#/assetQuickActions'
import Button from '#/components/common/button'
import Checkbox from '#/components/common/checkbox'
import KoboModal from '#/components/modals/koboModal'
import KoboModalContent from '#/components/modals/koboModalContent'
import KoboModalFooter from '#/components/modals/koboModalFooter'
import KoboModalHeader from '#/components/modals/koboModalHeader'
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
  const [isDataChecked, setIsDataChecked] = React.useState(false)
  const [isFormChecked, setIsFormChecked] = React.useState(false)
  const [isRecoverChecked, setIsRecoverChecked] = React.useState(false)
  const [isConfirmDeletePending, setIsConfirmDeletePending] = React.useState(false)

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
    <KoboModal
      isOpen={props.isOpen}
      onRequestClose={props.onRequestClose}
      isDismissableByDefaultMeans={!isConfirmDeletePending}
      size='medium'
    >
      <KoboModalHeader headerColor='white' onRequestCloseByX={props.onRequestClose}>
        {t('Delete ##ASSET_TYPE## "##NAME##"')
          .replace('##ASSET_TYPE##', assetTypeLabel)
          .replace('##NAME##', props.name)}
      </KoboModalHeader>
      <KoboModalContent>
        <Stack gap='md'>{promptContent}</Stack>
      </KoboModalContent>
      <KoboModalFooter>
        <Button
          type='secondary'
          size='m'
          label={t('Cancel')}
          onClick={props.onRequestClose}
          isDisabled={isConfirmDeletePending}
        />
        <Button
          type='danger'
          size='m'
          label={t('Delete')}
          onClick={onConfirmDelete}
          isDisabled={isConfirmDisabled}
          isPending={isConfirmDeletePending}
        />
      </KoboModalFooter>
    </KoboModal>
  )
}

export function useDeleteAssetPrompt() {
  const [promptRequest, setPromptRequest] = React.useState<PromptRequest | null>(null)

  const handleClosePrompt = React.useCallback(() => {
    setPromptRequest(null)
  }, [])

  const handleOpenPrompt = React.useCallback<OpenDeleteAssetPrompt>((asset, name, onDeleted) => {
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
