import { Group, Stack, Text } from '@mantine/core'
import ButtonNew from '#/components/common/ButtonNew'

export interface DeleteExportModalProps {
  onConfirm: () => void
  onCancel: () => void
}

export function DeleteExportModal({ onConfirm, onCancel }: DeleteExportModalProps) {
  return (
    <Stack gap='md'>
      <Text>{t('Are you sure you want to delete this export? This action is not reversible.')}</Text>

      <Group justify='flex-end' mt='lg'>
        <ButtonNew variant='light' size='md' onClick={onCancel}>
          {t('Cancel')}
        </ButtonNew>
        <ButtonNew variant='danger' size='md' onClick={onConfirm}>
          {t('Delete')}
        </ButtonNew>
      </Group>
    </Stack>
  )
}
