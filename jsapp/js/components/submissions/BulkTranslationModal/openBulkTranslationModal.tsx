import { Stack, Text } from '@mantine/core'
import { modals } from '@mantine/modals'
import Alert from '#/components/common/alert'
import type { BulkTranslationModalProps } from './BulkTranslationModal'
import { BulkTranslationModal } from './BulkTranslationModal'

export type BulkTranslationModalArgs = Omit<BulkTranslationModalProps, 'onRequestClose'>

export default function openBulkTranslationModal(args: BulkTranslationModalArgs) {
  if (args.showWarningModal) {
    const warningModalId = modals.openConfirmModal({
      title: t('Request too large'),
      size: 'lg',
      children: (
        <Stack gap='md'>
          <Text size='sm'>
            {t(
              'This bulk processing request is too large and could affect the performance of the application. Only the results currently visible in the data table (##count##) will be processed.',
            ).replace('##count##', String(args.selectedRowsCount))}
          </Text>

          <Alert type='info' iconName='information' m={0}>
            {t('To increase the number of files processed, increase the number of rows displayed in the table')}
          </Alert>
        </Stack>
      ),
      labels: {
        confirm: t('Continue'),
        cancel: t('Cancel'),
      },
      confirmProps: {
        variant: 'filled',
      },
      cancelProps: {
        variant: 'light',
      },
      onConfirm: () => {
        modals.close(warningModalId)
        openBulkTranslationModalInternal(args)
      },
    })
    return
  }

  openBulkTranslationModalInternal(args)
}

function openBulkTranslationModalInternal(args: BulkTranslationModalArgs) {
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
