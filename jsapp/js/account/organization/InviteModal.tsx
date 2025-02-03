import {Group, Modal, Stack, Text, TextInput, ModalProps} from '@mantine/core';
import ButtonNew from 'jsapp/js/components/common/ButtonNew';
import {Select} from 'jsapp/js/components/common/Select';
import {useSendMemberInvite} from './membersInviteQuery';
import {useState} from 'react';
import {OrganizationUserRole} from './organizationQuery';
import {KEY_CODES} from 'jsapp/js/constants';
import userExistence from 'js/users/userExistence.store';

export default function InviteModal(props: ModalProps) {
  const inviteQuery = useSendMemberInvite();

  const [textValue, setTextValue] = useState('');
  const [role, setRole] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const onInputKeyPress = (evt: React.KeyboardEvent<HTMLInputElement>) => {
    // TODO: disable send invite button until username is verified
    if (evt.key === String(KEY_CODES.ENTER)) {
      evt.currentTarget.blur();
      evt.preventDefault(); // prevent submitting form
    }
  };

  async function handleUsernameOrEmailCheck() {
    setErrorMessage(null);

    if (textValue === '' || textValue.includes('@')) {
      return;
    }

    //TODO: Keep some log of checked usernames in state to prevent unecessary queries

    const checkResult = await userExistence.checkUsername(textValue);
    if (checkResult === false) {
      setErrorMessage(t('This username does not exist. Please try again.'));
    } else {
      console.log('good');
    }
    // TODO: add username and its result into the state for future reference
    // TODO: only enable the send invite button after it successeds here.
  }

  // TODO: don't enable send invite button until role is selected

  const handleSendInvite = () => {
    if (role) {
      try {
        inviteQuery.mutateAsync({
          invitees: [textValue],
          role: role as OrganizationUserRole,
        });
      } catch (error) {
        // TODO: handle the error
      }
    }
  };

  return (
    <Modal
      opened={props.opened}
      onClose={props.onClose}
      title={t('Invite memebrs to your team')}
    >
      <Stack>
        <Text>
          {t(
            'Enter the username or email address of the person you wish to invite to your team. They will receive an invitation in their inbox.'
          )}
        </Text>
        <Group w='100%' gap='xs'>
          <TextInput
            flex={3}
            placeholder={t('Enter username or email address')}
            onChange={(e) => setTextValue(e.currentTarget.value)}
            onKeyDown={onInputKeyPress}
            onBlur={handleUsernameOrEmailCheck}
            error={errorMessage}
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
            disabled={errorMessage ? true : false}
            onClick={() => {
              console.log('--------email---------', textValue);
              console.log('--------role----------', role);
              handleSendInvite();
            }}
          >
            {t('Send invite')}
          </ButtonNew>
        </Group>
      </Stack>
    </Modal>
  );
}
