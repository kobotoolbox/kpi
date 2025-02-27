import type { ModalProps } from '@mantine/core'
import { Group, Modal, Stack, Text, TextInput, Loader } from '@mantine/core'
import ButtonNew from 'jsapp/js/components/common/ButtonNew'
import { Select } from 'jsapp/js/components/common/Select'
import { useSendMemberInvite } from './membersInviteQuery'
import { useState } from 'react'
import { OrganizationUserRole } from './organizationQuery'
import userExistence from 'js/users/userExistence.store'
import { useField } from '@mantine/form'
import { checkEmailPattern, notify } from 'js/utils'
import envStore from 'jsapp/js/envStore'
import subscriptionStore from 'jsapp/js/account/subscriptionStore'
import { getSimpleMMOLabel } from 'js/account/organization/organization.utils'

export default function InviteModal(props: ModalProps) {
  const inviteQuery = useSendMemberInvite()
  const mmoLabel = getSimpleMMOLabel(envStore.data, subscriptionStore.activeSubscriptions[0])

  const [role, setRole] = useState<string | null>(null)

  async function handleUsernameOrEmailCheck(value: string) {
    if (value === '' || checkEmailPattern(value)) {
      return null
    }

    const checkResult = await userExistence.checkUsername(value)
    if (checkResult === false) {
      return t('This username does not exist. Please try again.')
    } else {
      return null
    }
  }

  const userOrEmail = useField({
    initialValue: '',
    validate: handleUsernameOrEmailCheck,
    validateOnBlur: true,
  })

  const handleSendInvite = () => {
    if (role) {
      inviteQuery
        .mutateAsync({
          invitees: [userOrEmail.getValue()],
          role: role as OrganizationUserRole,
        })
        .then(() => {
          userOrEmail.reset()
          setRole(null)
          props.onClose()
        })
        .catch((error) => {
          if (error.responseText && JSON.parse(error.responseText)?.invitees) {
            notify(JSON.parse(error.responseText)?.invitees.join(), 'error')
          } else {
            notify(t('Failed to send invite'), 'error')
          }
        })
    }
  }

  const handleClose = () => {
    userOrEmail.reset()
    setRole(null)
    props.onClose()
  }

  const isValidated = !!role && userOrEmail.isDirty() && !userOrEmail.isValidating && !userOrEmail.error

  return (
    <Modal opened={props.opened} onClose={handleClose} title={t('Invite a member to your team')} size='lg'>
      <Stack>
        <Text>
          {t(
            'Enter the username or email address of the person you wish to invite to your ##TEAM_OR_ORGANIZATION##. They will receive an invitation in their inbox.',
          ).replace('##TEAM_OR_ORGANIZATION##', mmoLabel)}
        </Text>
        <Group align={'flex-start'} w='100%' gap='xs'>
          <TextInput
            flex={3}
            placeholder={t('Enter username or email address')}
            readOnly={userOrEmail.isValidating}
            rightSection={userOrEmail.isValidating && <Loader />}
            {...userOrEmail.getInputProps()}
          />
          <Select
            flex={2}
            placeholder='Role'
            data={[
              {
                value: OrganizationUserRole.admin,
                label: t('Admin'),
              },
              {
                value: OrganizationUserRole.member,
                label: t('Member'),
              },
            ]}
            value={role}
            onChange={setRole}
          />
        </Group>
        <Group w='100%' justify='flex-end'>
          <ButtonNew size='lg' disabled={!isValidated} onClick={handleSendInvite}>
            {t('Send invite')}
          </ButtonNew>
        </Group>
      </Stack>
    </Modal>
  )
}
