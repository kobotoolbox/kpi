import { useState } from 'react'

import { Anchor, Group, List, Stack, Text } from '@mantine/core'
import { modals } from '@mantine/modals'
import { fetchPost, handleApiFail } from '#/api'
import ButtonNew from '#/components/common/ButtonNew'
import Alert from '#/components/common/alert'
import Checkbox from '#/components/common/checkbox'
import type { AssetResponse, ProjectViewAsset } from '#/dataInterface'
import customViewStore from '#/projects/customViewStore'
import { ROUTES } from '#/router/routerConstants'
import { invalidateSidebarQueries } from '#/sidebar/SidebarFormsList'
import { useSession } from '#/stores/useSession'
import { notify } from '#/utils'

// Blocker modal — shown when one or more selected projects cannot be deleted
export interface BulkDeleteBlockerModalProps {
  assets: Array<AssetResponse | ProjectViewAsset>
  reason: 'submissions' | 'permissions'
  onRequestClose: () => void
}

export function BulkDeleteBlockerModal({ assets, reason, onRequestClose }: BulkDeleteBlockerModalProps) {
  const isSingle = assets.length === 1
  const assetsWithSubmissions = assets.filter((asset) => (asset.deployment__submission_count ?? 0) > 0)

  let body: string
  let alertText: string

  if (reason === 'submissions') {
    body = isSingle
      ? t('In order to delete this project, all submissions need to be deleted first')
      : t("The following projects have submissions and can't be deleted until all submissions have been deleted:")
    alertText = isSingle
      ? t(
          'Projects with data cannot be deleted as part of a team. Only empty projects with no submissions can be deleted.',
        )
      : t(
          'Projects with data cannot be deleted as part of a team. Please make sure none of the projects selected contain any submissions.',
        )
  } else {
    body = t(
      'Team projects with submissions can only be deleted by the Team owner. Only empty projects you created can be deleted.',
    )
    alertText = t(
      'Please make sure you can delete all the projects selected. Some may have been created by other members or contain data.',
    )
  }

  return (
    <Stack gap='md'>
      <Text size='sm'>{body}</Text>

      {reason === 'submissions' && !isSingle && assetsWithSubmissions.length > 0 && (
        <List size='sm'>
          {assetsWithSubmissions.map((asset) => (
            <List.Item key={asset.uid}>
              <Anchor href={ROUTES.FORM_LANDING.replace(':uid', asset.uid)}>{asset.name}</Anchor>
            </List.Item>
          ))}
        </List>
      )}

      <Alert type='info' iconName='information'>
        {alertText}
      </Alert>

      <Group justify='flex-end' mt='xs'>
        <ButtonNew variant='filled' size='md' onClick={onRequestClose}>
          {t('OK')}
        </ButtonNew>
      </Group>
    </Stack>
  )
}

// Confirm-delete modal
type AssetsBulkAction = 'archive' | 'delete' | 'unarchive'
interface AssetsBulkResponse {
  detail: string
}

export interface BulkDeleteModalProps {
  assetUids: string[]
  modalId: string
  onRequestClose: () => void
}

export function BulkDeleteModal({ assetUids, modalId, onRequestClose }: BulkDeleteModalProps) {
  const session = useSession()
  const orgUid = session.currentLoggedAccount?.organization?.uid

  const [isDataChecked, setIsDataChecked] = useState(false)
  const [isFormChecked, setIsFormChecked] = useState(false)
  const [isRecoverChecked, setIsRecoverChecked] = useState(false)
  const [isConfirmDeletePending, setIsConfirmDeletePending] = useState(false)

  function onConfirmDelete() {
    setIsConfirmDeletePending(true)
    modals.updateModal({ modalId, closeOnEscape: false, closeOnClickOutside: false })

    const payload: { asset_uids: string[]; action: AssetsBulkAction } = {
      asset_uids: assetUids,
      action: 'delete',
    }

    fetchPost<AssetsBulkResponse>('/api/v2/assets/bulk/', { payload: payload })
      .then((response) => {
        onRequestClose()
        customViewStore.handleAssetsDeleted(assetUids)
        notify(response.detail)
      })
      .catch((error) => {
        handleApiFail(error)
        setIsConfirmDeletePending(false)
        modals.updateModal({ modalId, closeOnEscape: true, closeOnClickOutside: true })
      })
      .finally(() => {
        // Ensure sidebar will refresh after bulk deletion is done.
        // In future we will use react-query for bulk deletion and then this invalidation will be done elsewhere.
        invalidateSidebarQueries(orgUid)
      })
  }

  const count = String(assetUids.length)

  return (
    <Stack gap='md'>
      <Text>{t('You are about to permanently delete ##count## projects').replace('##count##', count)}</Text>

      <Checkbox
        checked={isDataChecked}
        onChange={setIsDataChecked}
        label={t('All data gathered for these projects will be deleted')}
      />

      <Checkbox
        checked={isFormChecked}
        onChange={setIsFormChecked}
        label={t('Forms associated with these projects will be deleted')}
      />

      <strong>
        <Checkbox
          checked={isRecoverChecked}
          onChange={setIsRecoverChecked}
          label={t('I understand that if I delete these projects I will not be able to recover them')}
        />
      </strong>

      <Group justify='flex-end' mt='lg'>
        <ButtonNew variant='light' size='md' onClick={onRequestClose} disabled={isConfirmDeletePending}>
          {t('Cancel')}
        </ButtonNew>
        <ButtonNew
          variant='danger'
          size='md'
          onClick={onConfirmDelete}
          disabled={!isDataChecked || !isFormChecked || !isRecoverChecked}
          loading={isConfirmDeletePending}
        >
          {t('Delete')}
        </ButtonNew>
      </Group>
    </Stack>
  )
}
