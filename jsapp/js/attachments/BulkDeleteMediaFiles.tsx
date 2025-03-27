import { FocusTrap, Button, Box, Checkbox, Text, Stack, Group } from '@mantine/core'
import { Modal } from '@mantine/core'
import { useFeatureFlag, FeatureFlag } from '#/featureFlags'
import { useDisclosure } from '@mantine/hooks'
import { SubmissionResponse } from '#/dataInterface'
import { SubmissionAttachment } from '#/dataInterface'
import InlineMessage from '#/components/common/inlineMessage'

const isFeatureEnabled = useFeatureFlag(FeatureFlag.removingAttachmentsEnabled)

interface BulkDeleteMediaFilesProps {
  submissionData: SubmissionResponse[]
  selectedRows: string[] // an array of the selected submission UIDs
}

export default function BulkDeleteMediaFiles(props: BulkDeleteMediaFilesProps) {
  const [opened, { open, close }] = useDisclosure(false)
  let totalImages = 0
  let totalVideos = 0
  let totalFiles = 0
  let totalAudios = 0

  if (!isFeatureEnabled) {
    return null
  }

  // Get the submission data for only the selected submissions
  const selectedSubmissions: SubmissionResponse[] = []
  props.submissionData.forEach((submission) => {
    if (props.selectedRows.includes(String(submission._id))) {
      selectedSubmissions.push(submission)
    }
  })

  // Get an array of attachments for each selected submission
  const attachments: SubmissionAttachment[][] = []
  selectedSubmissions.forEach((submission) => {
    if (submission._attachments.length > 0) {
      attachments.push(submission._attachments)
    }
  })

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

  attachments.forEach((attArray) => {
    attArray.forEach((att) => {
      addMediaType(att.mimetype)
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

  return (
    <Box>
      <Button onClick={open} size='s' variant='transparent'>
        {t('Delete only media files')}
      </Button>

      <Modal opened={opened} onClose={close} title={t('Delete media files')} size={'md'}>
        <FocusTrap.InitialFocus />
        <Stack>
          <Checkbox
            label={
              <Text>
                {t('You are about to permanently remove the following media files from the selected submissions: ')}
                <br />
                {getMediaCount()}
              </Text>
            }
          />
          <InlineMessage
            icon='warning'
            type='warning'
            message={t('Careful - it is not possible to recover deleted media files')}
          />

          <Group justify='flex-end'>
            <Button variant='light' size='lg' onClick={close}>
              {t('Cancel')}
            </Button>

            <Button variant='danger' size='lg'>
              {/*TODO: Mock the bulk deleting here and see if handling it like the individual removal is possible (use the "is_deleted" mocking, see markAttachmentAsDeleted. This probably is not going to be easy without access to the submissions themselves*/}
              {t('Delete')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  )
}
