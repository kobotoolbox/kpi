import { Anchor, Group, Modal, Stack, Text } from '@mantine/core'
import ButtonNew from '#/components/common/ButtonNew'
import Alert from '#/components/common/alert'

interface MemberTransferModalProps {
  username: string
  targetFullName?: string | null
  orgName?: string
  isModalOpen: boolean
  isLoading?: boolean
  onCancel: () => void
  onConfirm: () => void
}

export default function TransferTeamOwnershipModal({
  username,
  targetFullName,
  orgName,
  isModalOpen,
  isLoading,
  onCancel,
  onConfirm,
}: MemberTransferModalProps) {
  const recipientLabel = targetFullName ? `${targetFullName} (@${username})` : `@${username}`

  return (
    <Modal size='lg' title={t('Transfer ownership')} opened={isModalOpen} onClose={onCancel}>
      <Stack>
        <Stack>
          <Text>
            {orgName
              ? t('This action will transfer ownership of ##orgName## to').replace('##orgName##', orgName)
              : t('This action will transfer ownership to')}
            {' '}
            <Text span fw={600}>{recipientLabel}</Text>
            {'.'}
          </Text>

          <Text>
            {t(
              'The new owner will receive an email request to accept the transfer. You will be notified when the transfer is accepted or declined.',
            )}
          </Text>

          <Alert type='error' iconName='alert'>
            <Text>
              {t('You will be the owner of the team until the transfer is accepted.')}
              {' '}
              <Text span fw={600}>
                {t('Once the transfer is accepted, you will not be able to undo this action.')}
                {' '}
                <Anchor href='#'>{t('Learn more')}</Anchor>
              </Text>
            </Text>
          </Alert>
        </Stack>

        <Group justify='flex-end'>
          <ButtonNew variant='light' onClick={onCancel} disabled={isLoading}>{t('Cancel')}</ButtonNew>
          <ButtonNew loading={isLoading} onClick={onConfirm}>{t('Continue')}</ButtonNew>
        </Group>
      </Stack>
    </Modal>
  )
}
