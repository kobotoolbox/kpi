import {Group, Modal, Stack, Text, TextInput, ModalProps, Loader} from '@mantine/core';
import ButtonNew from 'jsapp/js/components/common/ButtonNew';
import {Select} from 'jsapp/js/components/common/Select';
import {useSendMemberInvite} from './membersInviteQuery';
import {useState} from 'react';
import {OrganizationUserRole} from './organizationQuery';
import userExistence from 'js/users/userExistence.store';
import {useField} from '@mantine/form';
import {notify} from 'js/utils';

export default function InviteModal(props: ModalProps) {
  const inviteQuery = useSendMemberInvite();

  const [role, setRole] = useState<string | null>(null);

  async function handleUsernameOrEmailCheck(value: string) {
    if (value === '' || value.includes('@')) {
      return null;
    }

    const checkResult = await userExistence.checkUsername(value);
    if (checkResult === false) {
      return t('This username does not exist. Please try again.');
    } else {
      return null;
    }
  }

  const userOrEmail = useField({
    initialValue: '',

    validate: handleUsernameOrEmailCheck,
    validateOnBlur: true,
  });

  const handleSendInvite = () => {
    if (role) {
      inviteQuery
        .mutateAsync({
          invitees: [userOrEmail.getValue()],
          role: role as OrganizationUserRole,
        })
        .catch(() => {
          notify(t('Failed to send invite'), 'error');
        });
    }
  };

  const isValidated =
    role !== null &&
    userOrEmail.isDirty() &&
    !userOrEmail.isValidating &&
    !userOrEmail.error;

  return (
    <Modal
      opened={props.opened}
      onClose={props.onClose}
      title={t('Invite members to your team')}
      size={'lg'}
    >
      <Stack>
        <Text>
          {t(
            'Enter the username or email address of the person you wish to invite to your team. They will receive an invitation in their inbox.'
          )}
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
            placeholder={'Role'}
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
          <ButtonNew
            size='lg'
            disabled={!isValidated}
            onClick={handleSendInvite}
          >
            {t('Send invite')}
          </ButtonNew>
        </Group>
      </Stack>
    </Modal>
  );
}
