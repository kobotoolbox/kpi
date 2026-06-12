import { useState } from 'react'

import { Group, Stack, Text } from '@mantine/core'
import { modals } from '@mantine/modals'
import { fetchPost, handleApiFail } from '#/api'
import ButtonNew from '#/components/common/ButtonNew'
import Alert from '#/components/common/alert'
import Checkbox from '#/components/common/checkbox'
import customViewStore from '#/projects/customViewStore'
import { invalidateSidebarQueries } from '#/sidebar/SidebarFormsList'
import { useSession } from '#/stores/useSession'
import { notify } from '#/utils'

// Blocker modal — shown when one or more selected projects cannot be deleted
export interface BulkDeleteBlockerModalProps {
  onRequestClose: () => void
  reason: 'submissions' | 'permissions'
}

export function BulkDeleteBlockerModal({ onRequestClose, reason }: BulkDeleteBlockerModalProps) {
  const body =
    reason === 'submissions'
      ? t('In order to delete projects, all submissions need to be deleted first.')
      : t("Some of the selected projects can't be deleted because you don't have the required permissions.")

  const alert =
    reason === 'submissions'
      ? t(
          'Projects with data cannot be deleted as part of a team. Please make sure none of the projects selected contain any submissions.',
        )
      : t('Please make sure you have delete permissions for all selected projects, or contact an administrator.')

  return (
    <Stack gap='md'>
      <Text>{body}</Text>

      <Alert type='info' iconName='information'>
        {alert}
      </Alert>

      <Group justify='flex-end' mt='lg'>
        <ButtonNew variant='light' size='md' onClick={onRequestClose}>
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
