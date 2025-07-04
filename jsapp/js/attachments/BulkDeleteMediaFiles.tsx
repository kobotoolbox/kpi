import { Anchor, Box, Button, Checkbox, FocusTrap, Group, Modal, Stack, Text } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { useState } from 'react'
import { actions } from '#/actions'
import { handleApiFail } from '#/api'
import Alert from '#/components/common/alert'
import { PERMISSIONS_CODENAMES } from '#/components/permissions/permConstants'
import { userHasPermForSubmission } from '#/components/permissions/utils'
import { getMediaCount } from '#/components/submissions/submissionUtils'
import type { AssetResponse, FailResponse, SubmissionResponse } from '#/dataInterface'
import { notify, removeDefaultUuidPrefix } from '#/utils'
import { useRemoveBulkAttachments } from './attachmentsQuery'

interface BulkDeleteMediaFilesProps {
  // An array of all selected submissions with a valid set of attachments to be deleted
  selectedSubmissions: SubmissionResponse[]
  asset: AssetResponse
  onDeleted: () => void
}

export default function BulkDeleteMediaFiles(props: BulkDeleteMediaFilesProps) {
  const [opened, { open, close }] = useDisclosure(false)
  const [isDeletePending, setIsDeletePending] = useState(false)
  const [warningAcknowledged, setWarningAcknowledged] = useState(false)

  const removeBulkAttachments = useRemoveBulkAttachments(props.asset.uid)

  // Filter submissions based on partial permissions
  const filteredSubmissions = props.selectedSubmissions.filter((submission) =>
    userHasPermForSubmission(PERMISSIONS_CODENAMES.change_submissions, props.asset, submission),
  )

  const handleConfirmDelete = async () => {
    const selectedRootUuids = props.selectedSubmissions.map((submission) =>
      submission['meta/rootUuid'] ? removeDefaultUuidPrefix(submission['meta/rootUuid']) : submission['_uuid'],
    )
    setIsDeletePending(true)

    try {
      await removeBulkAttachments.mutateAsync(selectedRootUuids)
      // Prompt table to refresh submission list
      actions.resources.refreshTableSubmissions()
      handleCloseModal()
      notify(
        t('Media files from ##number_of_selected_submissions## submission(s) have been deleted').replace(
          '##number_of_selected_submissions##',
          filteredSubmissions.length.toString(),
        ),
      )
    } catch (error) {
      handleApiFail(error as FailResponse)
    } finally {
      setIsDeletePending(false)
    }
  }

  const handleCloseModal = () => {
    setWarningAcknowledged(false)
    close()
  }

  return (
    <Box>
      <Anchor onClick={open} underline='always' fw={'bold'} c={'blue.4'}>
        {t('Delete media files only')}
      </Anchor>

      <Modal opened={opened} onClose={handleCloseModal} title={t('Delete media files')} size={'md'}>
        <FocusTrap.InitialFocus />

        {filteredSubmissions.length === 0 && (
          // This can only happen if the user has permissions to view (but not delete) certain submissions
          <Stack>
            <Text>
              {t('You do not have sufficient permissions to delete attachments from the selected submissions.')}
            </Text>
          </Stack>
        )}

        {filteredSubmissions.length > 0 && (
          <Stack>
            <Checkbox
              label={
                <Text>
                  {t('You are about to permanently remove the following media files from the selected submissions:')}
                  <br />
                  {getMediaCount(filteredSubmissions)}
                </Text>
              }
              onChange={(evt: React.ChangeEvent<HTMLInputElement>) => setWarningAcknowledged(evt.currentTarget.checked)}
              checked={warningAcknowledged}
            />
            <Alert iconName='warning' type='error'>
              {t('Careful - it is not possible to recover deleted media files')}
            </Alert>
            <Group justify='flex-end'>
              <Button variant='light' size='lg' onClick={handleCloseModal} disabled={isDeletePending}>
                {t('Cancel')}
              </Button>

              <Button
                disabled={!warningAcknowledged || isDeletePending}
                variant='danger'
                size='lg'
                onClick={handleConfirmDelete}
              >
                {t('Delete')}
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Box>
  )
}
