import { FocusTrap, Group, Stack, Text } from '@mantine/core'
import React from 'react'
import ButtonNew from '#/components/common/ButtonNew'
import ModalNew from '#/components/common/ModalNew'
import Alert from '#/components/common/alert'

interface ManagedSsoConfirmModalProps {
  providerName: string
  connectHref: string
  onClose: () => void
}

export default function ManagedSsoConfirmModal({ providerName, connectHref, onClose }: ManagedSsoConfirmModalProps) {
  return (
    <ModalNew
      opened
      onClose={onClose}
      title={t('Connecting with ##provider##').replace(/##provider##/g, providerName)}
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

          <ButtonNew size='md' component='a' href={connectHref}>
            {t('Proceed')}
          </ButtonNew>
        </Group>
      </Stack>
    </ModalNew>
  )
}
