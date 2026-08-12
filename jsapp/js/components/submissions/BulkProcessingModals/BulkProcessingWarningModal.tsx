import { Group, Stack, Text } from '@mantine/core'
import Alert from '#/components/common/alert'
import ButtonNew from '../../common/ButtonNew'

interface BulkProcessingWarningModalProps {
  selectedRowsCount: number
  onRequestClose: () => void
  handleWarningContinue: () => void
}

export function BulkProcessingWarningModal(props: BulkProcessingWarningModalProps) {
  return (
    <Stack gap='md'>
      <Text size='sm'>
        {t(
          'This bulk processing request is too large and could affect the performance of the application. Only the results currently visible in the data table (##count##) will be processed.',
        ).replace('##count##', String(props.selectedRowsCount))}
      </Text>

      <Alert type='info' iconName='information' m={0}>
        {t('To increase the number of files processed, increase the number of rows displayed in the table')}
      </Alert>
      <Group justify='flex-end' mt='md'>
        <ButtonNew onClick={props.onRequestClose} variant='light'>
          {t('Cancel')}
        </ButtonNew>
        <ButtonNew onClick={props.handleWarningContinue}>{t('Continue')}</ButtonNew>
      </Group>
    </Stack>
  )
}
