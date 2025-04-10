import { Anchor, Box, Button, Checkbox, FocusTrap, Group, Modal, Stack, Text } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { useState } from 'react'
import Alert from '#/components/common/alert'
import { getMediaCount } from '#/components/submissions/submissionUtils'
import type { SubmissionResponse } from '#/dataInterface'
import { FeatureFlag, useFeatureFlag } from '#/featureFlags'
import { notify } from '#/utils'
import { useRemoveBulkAttachments } from './attachmentsQuery'

interface BulkDeleteMediaFilesProps {
  // An array of all selected submissions with a valid set of attachments to be deleted
  selectedSubmissions: SubmissionResponse[]
  assetUid: string
  onDeleted: () => void
}

export default function BulkDeleteMediaFiles(props: BulkDeleteMediaFilesProps) {
  const isFeatureEnabled = useFeatureFlag(FeatureFlag.removingAttachmentsEnabled)

  const [opened, { open, close }] = useDisclosure(false)
  const [isDeletePending, setIsDeletePending] = useState(false)
  const [warningAcknowledged, setWarningAcknowledged] = useState(false)

  const removeBulkAttachments = useRemoveBulkAttachments(props.assetUid)

  if (!isFeatureEnabled) {
    return null
  }

  const handleConfirmDelete = async () => {
    const selectedIds = props.selectedSubmissions.map((submission) => submission._id)
    setIsDeletePending(true)

    try {
      await removeBulkAttachments.mutateAsync(selectedIds)
      close()
      notify(
        t('Media files from ##number_of_selected_submissions## submission(s) have been deleted').replace(
          '##number_of_selected_submissions##',
          props.selectedSubmissions.length.toString(),
        ),
      )
    } catch (error) {
      notify(t('An error occurred while removing the attachments'), 'error')
    } finally {
      setIsDeletePending(false)
    }
  }

  return (
    <Box>
      <Anchor onClick={open} underline='always' fw={'bold'} c={'blue.4'}>
        {t('Delete media files only')}
      </Anchor>

      <Modal opened={opened} onClose={close} title={t('Delete media files')} size={'md'}>
        <FocusTrap.InitialFocus />
        <Stack>
          <Checkbox
            label={
              <Text>
                {t('You are about to permanently remove the following media files from the selected submissions:')}
                <br />
                {getMediaCount(props.selectedSubmissions)}
              </Text>
            }
            onClick={() => setWarningAcknowledged(!warningAcknowledged)}
          />
          <Alert iconName='warning' type='error'>
            {t('Careful - it is not possible to recover deleted media files')}
          </Alert>
          <Group justify='flex-end'>
            <Button variant='light' size='lg' onClick={close} disabled={isDeletePending}>
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
      </Modal>
    </Box>
  )
}
