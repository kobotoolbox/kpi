import { modals } from '@mantine/modals'
import type { BulkTranslationModalProps } from './BulkTranslationModal'
import { BulkTranslationModal } from './BulkTranslationModal'

export type BulkTranslationModalArgs = Omit<BulkTranslationModalProps, 'onRequestClose'>

export default function openBulkTranslationModal(args: BulkTranslationModalArgs) {
  const modalId = modals.open({
    title: t('Translate selected transcripts'),
    size: 'lg',
    children: (
      <BulkTranslationModal
        onRequestClose={() => {
          modals.close(modalId)
        }}
        {...args}
      />
    ),
  })
}
