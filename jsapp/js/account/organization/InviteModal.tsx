import {Group, Modal, Stack, Text, TextInput, ModalProps} from '@mantine/core';
import ButtonNew from 'jsapp/js/components/common/ButtonNew';
import {Select} from 'jsapp/js/components/common/Select';
import {useSendMemberInvite} from './membersInviteQuery';
import {useState} from 'react';
import {OrganizationUserRole} from './organizationQuery';

export default function InviteModal(props: ModalProps) {
  const inviteQuery = useSendMemberInvite();

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<string | null>(null);

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
            onChange={(e) => setEmail(e.currentTarget.value)}
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
            onClick={() => {
              console.log('--------email---------', email);
              console.log('--------role----------', role);
              useSendMemberInvite();
            }}
          >
            {t('Send invite')}
          </ButtonNew>
        </Group>
      </Stack>
    </Modal>
  );
}
