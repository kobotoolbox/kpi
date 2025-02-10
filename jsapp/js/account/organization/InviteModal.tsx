import { Group, Modal, Stack, Text, TextInput, ModalProps } from '@mantine/core'
import ButtonNew from 'jsapp/js/components/common/ButtonNew'
import { Select } from 'jsapp/js/components/common/Select'

export default function InviteModal(props: ModalProps) {
  return (
    <Modal opened={props.opened} onClose={props.onClose} title={t('Invite memebrs to your team')}>
      <Stack>
        <Text>
          {t(
            'Enter the username or email address of the person you wish to invite to your team. They will receive an invitation in their inbox.',
          )}
        </Text>
        <Group w='100%' gap='xs'>
          <TextInput flex={3} placeholder={t('Enter username or email address')} />
          <Select flex={2} placeholder={'Role'} data={['Owner', 'Admin', 'Member']} />
        </Group>
        <Group w='100%' justify='flex-end'>
          <ButtonNew size='lg'>{t('Send invite')}</ButtonNew>
        </Group>
      </Stack>
    </Modal>
  )
}
