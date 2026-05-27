import { Group, Text } from '@mantine/core'
import ModalNew from '#/components/common/ModalNew'
import ButtonNew from '../common/ButtonNew'

interface Props {
  opened: boolean
  onClose: () => void
}

export default function BulkTranscriptionModal({ opened, onClose }: Props) {
  return (
    <ModalNew
      opened={opened}
      onClose={onClose}
      title={t('Transcribe selected audio files')}
      size='md'
      centered
      withOverlay={true}
      closeOnEscape={false}
    >
      <Text size='sm' mb='sm'>
        {t('Start transcribing audio')}
      </Text>

      <Group>
        <ButtonNew onClick={onClose}>{t('Cancel')}</ButtonNew>
        <ButtonNew
          onClick={() => {
            onClose()
          }}
        >
          {t('Start Transcription')}
        </ButtonNew>
      </Group>
    </ModalNew>
  )
}
