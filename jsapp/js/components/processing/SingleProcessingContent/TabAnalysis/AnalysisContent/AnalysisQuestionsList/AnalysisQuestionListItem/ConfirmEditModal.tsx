import type { ModalProps } from '@mantine/core'
import { Group, Modal, Stack, Text } from '@mantine/core'
import ButtonNew from '#/components/common/ButtonNew'
import type { ResponseManualQualActionParams } from '#/api/models/responseManualQualActionParams'
import Alert from '#/components/common/alert'

export interface ConfirmEditModalProps extends ModalProps {
  qaQuestion: ResponseManualQualActionParams
  onConfirmEdit: (qaQuestionToEdit: ResponseManualQualActionParams) => void
}

export default function ConfirmEditModal(props: ConfirmEditModalProps) {
  const handleConfirm = () => {
    props.onConfirmEdit(props.qaQuestion)
  }

  return (
    <Modal opened={props.opened} onClose={props.onClose} title={t('Edit this question?')} size='md'>
      <Stack>
        <Text>
          {t(
            'Editing will update this question for all submissions, including those already answered, and may make existing responses outdated.',
          )}
        </Text>

        <Alert iconName='warning' type='warning'>
          {t('If you still want to make changes, please review and update existing responses accordingly.')}
        </Alert>

        <Group justify='flex-end'>
          <ButtonNew size='md' onClick={props.onClose} variant='light'>
            {t('Cancel')}
          </ButtonNew>

          <ButtonNew size='md' onClick={handleConfirm}>
            {t('Continue')}
          </ButtonNew>
        </Group>
      </Stack>
    </Modal>
  )
}
