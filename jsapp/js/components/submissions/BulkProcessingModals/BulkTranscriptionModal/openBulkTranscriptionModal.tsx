import { modals } from '@mantine/modals'
import type { BulkTranscriptionModalProps } from './BulkTranscriptionModal'
import { BulkTranscriptionModal } from './BulkTranscriptionModal'

export type BulkTranscriptionModalArgs = Omit<BulkTranscriptionModalProps, 'onRequestClose'>

export default function openBulkTranscriptionModal(args: BulkTranscriptionModalArgs) {
  const modalId = modals.open({
    title: t('Transcribe selected audio files'),
    size: 'lg',
    children: (
      <BulkTranscriptionModal
        onRequestClose={() => {
          modals.close(modalId)
        }}
        {...args}
      />
    ),
  })
}
