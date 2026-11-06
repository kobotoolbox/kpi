import { Anchor, Checkbox, Group, Stack, Text } from '@mantine/core'
import { useState } from 'react'
import ButtonNew from '#/components/common/ButtonNew'
import ModalNew from '#/components/common/ModalNew'
import Alert from '#/components/common/alert'
import envStore from '#/envStore'

interface TransferTeamOwnershipModalProps {
  username: string
  targetFullName?: string | null
  orgName: string
  isModalOpen: boolean
  isLoading?: boolean
  onCancel: () => void
  onConfirm: (showBillingDetails: boolean) => void
}

export default function TransferTeamOwnershipModal({
  username,
  targetFullName,
  orgName,
  isModalOpen,
  isLoading,
  onCancel,
  onConfirm,
}: TransferTeamOwnershipModalProps) {
  const recipientLabel = targetFullName ? `${targetFullName} (@${username})` : `@${username}`
  const [showBillingDetails, setShowBillingDetails] = useState(false)
  const [beforeRecipient, afterRecipient = ''] = t(
    'This action will transfer ownership of ##orgName## to ##recipient##.',
  )
    .replace('##orgName##', orgName)
    .split('##recipient##')

  return (
    <ModalNew
      size='lg'
      title={t('Transfer ownership')}
      opened={isModalOpen}
      onClose={onCancel}
      // Reset once fully closed, so the next opening starts fresh without the checkbox visibly flipping mid-fade
      onExitTransitionEnd={() => setShowBillingDetails(false)}
    >
      <Stack>
        <Stack>
          <Text>
            {beforeRecipient}
            <Text span fw={600}>
              {recipientLabel}
            </Text>
            {afterRecipient}
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
            checked={showBillingDetails}
            label={t('Display billing details for the new owner to review')}
            onChange={(event) => setShowBillingDetails(event.currentTarget.checked)}
          />
        </Stack>

        <Group justify='flex-end'>
          <ButtonNew variant='light' onClick={onCancel} disabled={isLoading}>
            {t('Cancel')}
          </ButtonNew>
          <ButtonNew loading={isLoading} onClick={() => onConfirm(showBillingDetails)}>
            {t('Continue')}
          </ButtonNew>
        </Group>
      </Stack>
    </ModalNew>
  )
}
