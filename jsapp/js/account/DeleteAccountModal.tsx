import type { ModalProps } from '@mantine/core'
import { Group, Loader, Modal, Stack, Text, TextInput } from '@mantine/core'
import { useField } from '@mantine/form'
import { useState } from 'react'
import { fetchDelete } from '#/api'
import { endpoints } from '#/api.endpoints'
import ButtonNew from '#/components/common/ButtonNew'
import { useSession } from '#/stores/useSession'
import { notify } from '#/utils'

export default function DeleteAccountModal(props: ModalProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const session = useSession()

  function isUsernameOk(username: string) {
    return username === session.currentLoggedAccount.username
  }

  const usernameField = useField({
    initialValue: '',
    validate: (value) => (isUsernameOk(value) ? null : t('Please fill in your username to continue')),
    validateOnBlur: true,
  })

  const handleConfirmDeleteAccount = () => {
    setIsDeleting(true)
    fetchDelete(endpoints.ME, { confirm: session.currentLoggedAccount.extra_details__uid })
      .then(() => {
        setIsDeleting(false)
        // We can't use `session.logOut` because it needs authentication to work, and after successful API call, account
        // is no longer authenticated. We force reload to leave the UI:
        window.location.replace('')
      })
      .catch((errorResponse: any) => {
        console.error(errorResponse)
        setIsDeleting(false)
        notify.error(t('Cannot delete account'))
      })
  }

  const handleClose = () => {
    usernameField.reset()
    props.onClose()
  }

  const isConfirmDisabled = !isUsernameOk(usernameField.getValue())

  return (
    <Modal opened={props.opened} onClose={handleClose} title={t('Delete your account')} size='md'>
      <Stack>
        <Text>
          {t('Are you sure you want to delete your account?')}{' '}
          <strong>{t('This action cannot be undone once completed.')}</strong>
        </Text>

        <TextInput
          required
          label={t('To complete this action, please enter your username below')}
          readOnly={usernameField.isValidating}
          rightSection={usernameField.isValidating && <Loader />}
          {...usernameField.getInputProps()}
        />

        <Group align='right'>
          <ButtonNew size='md' onClick={handleClose} variant='light'>
            {t('Cancel')}
          </ButtonNew>

          <ButtonNew
            size='md'
            disabled={isConfirmDisabled}
            onClick={handleConfirmDeleteAccount}
            variant='danger'
            loading={isDeleting}
          >
            {t('Delete account')}
          </ButtonNew>
        </Group>
      </Stack>
    </Modal>
  )
}
