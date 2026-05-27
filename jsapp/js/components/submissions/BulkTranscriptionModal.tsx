import { Group, Text } from '@mantine/core'
import ButtonNew from '../common/ButtonNew'
import ModalMantine from '../common/ModalNew'

interface Props {
  opened: boolean
  onClose: () => void
}

export default function BulkTranscriptionModal({ opened, onClose }: Props) {
  return (
    <ModalMantine opened={opened} onClose={onClose} title='Transcribe selected audio files' size='md' centered>
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
    </ModalMantine>
  )
}
