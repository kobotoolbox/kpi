import { FocusTrap, Button, Box, Checkbox, Text, Stack, Group } from '@mantine/core'
import { Modal } from '@mantine/core'
import { useFeatureFlag, FeatureFlag } from '#/featureFlags'
import { useDisclosure } from '@mantine/hooks'
import { SubmissionResponse } from '#/dataInterface'
import InlineMessage from '#/components/common/inlineMessage'
import { useRemoveBulkAttachments } from './attachmentsQuery'
import { useState } from 'react'
import { notify } from '#/utils'
import {Anchor} from '@mantine/core'

const isFeatureEnabled = useFeatureFlag(FeatureFlag.removingAttachmentsEnabled)

interface BulkDeleteMediaFilesProps {
  selectedSubmissions: SubmissionResponse[]
  selectedRowIds: string[] // an array of the selected submission UIDs
  assetUid: string
}

export default function BulkDeleteMediaFiles(props: BulkDeleteMediaFilesProps) {
  const [opened, { open, close }] = useDisclosure(false)
  const [isDeletePending, setIsDeletePending] = useState(false)
  const [warningSurpressed, setWarningSurpressed] = useState(false)

  const removeBulkAttachments = useRemoveBulkAttachments(props.assetUid)

  let totalImages = 0
  let totalVideos = 0
  let totalFiles = 0
  let totalAudios = 0

  if (!isFeatureEnabled) {
    return null
  }

  const addMediaType = (mimetype: string) => {
    if (mimetype.includes('image/')) {
      totalImages++
    } else if (mimetype.includes('video/')) {
      totalVideos++
    } else if (mimetype.includes('application/')) {
      totalFiles++
    } else if (mimetype.includes('audio/')) {
      totalAudios++
    }
  }

  // For each attachment in a submission, we add it to the list of parameters and increase that media file type count
  props.selectedSubmissions.forEach((submission) => {
      submission._attachments.forEach((attachment) => {
          addMediaType(attachment.mimetype)
      })
  })

  const getMediaCount = () => {
    let images = ''
    let audios = ''
    let videos = ''
    let files = ''

    if (totalImages > 1) {
      images = t('##media## images').replace('##media##', String(totalImages))
    } else if (totalImages === 1) {
      images = t('##media## image').replace('##media##', String(totalImages))
    }
    if (totalVideos > 1) {
      videos = t('##media## videos').replace('##media##', String(totalVideos))
    } else if (totalVideos === 1) {
      videos = t('##media## video').replace('##media##', String(totalVideos))
    }
    if (totalAudios > 1) {
      audios = t('##media## audios').replace('##media##', String(totalAudios))
    } else if (totalAudios === 1) {
      audios = t('##media## audio').replace('##media##', String(totalAudios))
    }
    if (totalFiles > 1) {
      files = t('##media## files').replace('##media##', String(totalFiles))
    } else if (totalFiles === 1) {
      files = t('##media## file').replace('##media##', String(totalFiles))
    }

    const result = [images, videos, audios, files]
    return result.join(', ') + '.'
  }

  const handleConfirmDelete = async () => {
    setIsDeletePending(true)

    try {
      for await (const submission of props.selectedSubmissions) {
        await removeBulkAttachments.mutateAsync(submission._id.toString())
      }
      notify(
        t('Media files from ##Number_of_selected_submissions## submission(s) have been deleted').replace(
          '##Number_of_selected_submissions##',
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
      <Anchor onClick={open} underline='always' fw={'bold'}>
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
            onClick={() => setWarningSurpressed(!warningSurpressed)}
          />
          <InlineMessage
            icon='warning'
            type='warning'
            message={t('Careful - it is not possible to recover deleted media files')}
          />

          <Group justify='flex-end'>
            <Button variant='light' size='lg' onClick={close} disabled={isDeletePending}>
              {t('Cancel')}
            </Button>

            <Button
              disabled={!warningSurpressed || isDeletePending}
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
