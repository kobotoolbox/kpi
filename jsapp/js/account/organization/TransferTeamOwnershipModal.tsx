import { Anchor, Checkbox, Group, Modal, Stack, Text } from '@mantine/core'
import { useState } from 'react'
import ButtonNew from '#/components/common/ButtonNew'
import Alert from '#/components/common/alert'
import envStore from '#/envStore'

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
  const [checked, setChecked] = useState(false)

  return (
    <Modal size='lg' title={t('Transfer ownership')} opened={isModalOpen} onClose={onCancel}>
      <Stack>
        <Stack>
          <Text>
            {orgName
              ? t('This action will transfer ownership of ##orgName## to').replace('##orgName##', orgName)
              : t('This action will transfer ownership to')}{' '}
            <Text span fw={600}>
              {recipientLabel}
            </Text>
            {'.'}
          </Text>

          <Text>
            {t(
              'The new owner will receive an email request to accept the transfer. You will be notified when the transfer is accepted or declined.',
            )}
          </Text>

          <Alert type='error' iconName='alert'>
            <Text>
              {t('You will be the owner of the team until the transfer is accepted.')}{' '}
              <Text span fw={600}>
                {t('Once the transfer is accepted, you will not be able to undo this action.')}{' '}
                {envStore.isReady && envStore.data.support_url && (
                  <Anchor href={envStore.data.support_url} target='_blank'>
                    {t('Learn more')}
                  </Anchor>
                )}
              </Text>
            </Text>
          </Alert>

          <Checkbox
            checked={checked}
            label={t('Display billing details for the new owner to review')}
            onChange={(event) => setChecked(event.currentTarget.checked)}
          />
        </Stack>

        <Group justify='flex-end'>
          <ButtonNew variant='light' onClick={onCancel} disabled={isLoading}>
            {t('Cancel')}
          </ButtonNew>
          <ButtonNew loading={isLoading} onClick={onConfirm}>
            {t('Continue')}
          </ButtonNew>
        </Group>
      </Stack>
    </Modal>
  )
}
