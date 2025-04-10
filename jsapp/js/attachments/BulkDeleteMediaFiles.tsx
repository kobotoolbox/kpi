import { Box, Button, Checkbox, FocusTrap, Group, Stack, Text, Modal, Anchor, Alert } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { useState } from 'react'
import InlineMessage from '#/components/common/inlineMessage'
import type { SubmissionResponse } from '#/dataInterface'
import { FeatureFlag, useFeatureFlag } from '#/featureFlags'
import { notify } from '#/utils'
import { useRemoveBulkAttachments } from './attachmentsQuery'

interface BulkDeleteMediaFilesProps {
  selectedSubmissions: SubmissionResponse[]
  selectedRowIds: string[] // an array of the selected submission UIDs
  assetUid: string
}

export default function BulkDeleteMediaFiles(props: BulkDeleteMediaFilesProps) {
  const isFeatureEnabled = useFeatureFlag(FeatureFlag.removingAttachmentsEnabled)

  const [opened, { open, close }] = useDisclosure(false)
  const [isDeletePending, setIsDeletePending] = useState(false)
  const [warningAcknowledged, setWarningAcknowledged] = useState(false)

  const removeBulkAttachments = useRemoveBulkAttachments(props.assetUid)

  let totalImages = 0
  let totalVideos = 0
  let totalFiles = 0
  let totalAudios = 0

  if (!isFeatureEnabled) {
    return null
  }

  // For each attachment in a submission, we add it to the list of parameters and increase that media file type count
  props.selectedSubmissions.forEach((submission) => {
    submission._attachments.forEach((attachment) => {
      const mimetype = attachment.mimetype
      if (mimetype.includes('image/')) {
        totalImages++
      } else if (mimetype.includes('video/')) {
        totalVideos++
      } else if (mimetype.includes('application/')) {
        totalFiles++
      } else if (mimetype.includes('audio/')) {
        totalAudios++
      }
    })
  })

  const getMediaCount = () => {
    const mediaTypes = [
      { count: totalImages, singular: t('image'), plural: t('images') },
      { count: totalVideos, singular: t('video'), plural: t('videos') },
      { count: totalAudios, singular: t('audio'), plural: t('audios') },
      { count: totalFiles, singular: t('file'), plural: t('files') },
    ]
    const result = mediaTypes
      .filter(({ count }) => count > 0)
      .map(({ count, singular, plural }) => t(`##media## ${count > 1 ? plural : singular}`).replace('##media##', '')) //TODO: throws a weird undefined error
    return result.join('; ') + '.'
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
      <Anchor onClick={open} underline='always' fw={'bold'} c={'dark-blue'}>
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
                {getMediaCount()}
              </Text>
            }
            onClick={() => setWarningAcknowledged(!warningAcknowledged)}
          />
          <Alert icon='warning' type='warning'>
            label={t('Careful - it is not possible to recover deleted media files')}
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
