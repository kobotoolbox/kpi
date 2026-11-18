import { FocusTrap, Group, Stack, Text } from '@mantine/core'
import React from 'react'
import ButtonNew from '#/components/common/ButtonNew'
import ModalNew from '#/components/common/ModalNew'
import Alert from '#/components/common/alert'
import SsoConnectButton from './SsoConnectButton'

interface ManagedSsoConfirmModalProps {
  providerName: string
  /** `provider_id` of the `SocialApp` this confirms connecting to */
  providerId: string
  onClose: () => void
}

export default function ManagedSsoConfirmModal({ providerName, providerId, onClose }: ManagedSsoConfirmModalProps) {
  return (
    <ModalNew
      opened
      onClose={onClose}
      title={t('Connecting with ##provider##').replace('##provider##', providerName)}
      size='md'
    >
      <FocusTrap.InitialFocus />

      <Stack>
        <Text>
          {t(
            'Your organization has restricted the use of passwords for single-sign on (SSO) accounts. Once enabled, SSO cannot be disabled again without direct support from your system administrator.',
          )}
        </Text>

        <Alert type='warning' iconName='alert'>
          {t(
            'Please note that your password will be deleted and you will only be able to log in using single-sign on (SSO).',
          )}
        </Alert>

        <Group justify='flex-end'>
          <ButtonNew size='md' variant='light' onClick={onClose}>
            {t('Go back')}
          </ButtonNew>

          <SsoConnectButton providerId={providerId} size='md'>
            {t('Proceed')}
          </SsoConnectButton>
        </Group>
      </Stack>
    </ModalNew>
  )
}
