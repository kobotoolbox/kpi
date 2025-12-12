import type { ModalProps } from '@mantine/core'
import { Group, Loader, Modal, Stack, Text, TextInput } from '@mantine/core'
import { useField } from '@mantine/form'
import { useState } from 'react'
import { getSimpleMMOLabel } from '#/account/organization/organization.utils'
import subscriptionStore from '#/account/subscriptionStore'
import { InviteeRoleEnum } from '#/api/models/inviteeRoleEnum'
import { useOrganizationsInvitesCreate } from '#/api/react-query/user-team-organization-usage'
import { useOrganizationAssumed } from '#/api/useOrganizationAssumed'
import ButtonNew from '#/components/common/ButtonNew'
import Select from '#/components/common/Select'
import type { FailResponse } from '#/dataInterface'
import envStore from '#/envStore'
import userExistence from '#/users/userExistence.store'
import { checkEmailPattern, notify } from '#/utils'

export default function InviteModal(props: ModalProps) {
  const [organization] = useOrganizationAssumed()
  const mmoLabel = getSimpleMMOLabel(envStore.data, subscriptionStore.activeSubscriptions[0])

  const orgInviteCreate = useOrganizationsInvitesCreate()

  const [role, setRole] = useState<InviteeRoleEnum | null>(null)

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

  const handleSendInvite = async () => {
    if (!role) return
    try {
      await orgInviteCreate.mutateAsync({
        uidOrganization: organization.id,
        data: {
          invitees: [userOrEmail.getValue()],
          role: role,
        },
      })
      userOrEmail.reset()
      setRole(null)
      props.onClose()
    } catch (error) {
      const responseText = (error as FailResponse).responseText
      if (responseText && JSON.parse(responseText)?.invitees) {
        notify(JSON.parse(responseText)?.invitees.join(), 'error')
      } else {
        console.error(error)
        notify(t('Failed to send invite'), 'error')
      }
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
                value: InviteeRoleEnum.admin,
                label: t('Admin'),
              },
              {
                value: InviteeRoleEnum.member,
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
