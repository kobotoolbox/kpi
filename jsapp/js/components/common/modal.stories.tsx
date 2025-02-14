import type {ModalProps} from '@mantine/core';
import {Button, Center, Modal, Stack, Text, Group} from '@mantine/core';
import type {Meta, StoryObj} from '@storybook/react';
import {useArgs} from '@storybook/preview-api';

const RenderModal = ({...args}: ModalProps) => {
  const [{opened}, updateArgs] = useArgs();

  return (
    <Center w={400} h={80}>
      <Button onClick={() => updateArgs({opened: !opened})}>Open modal</Button>
      <Modal {...args} onClose={() => updateArgs({opened: !opened})}>
        <Stack>
          <Text p='md'>
            Example modal content. Press esc, click outside or close button to
            close.
          </Text>
          <Group justify='flex-end'>
            <Button variant='danger'>Won&apos;t close</Button>
            <Button onClick={() => updateArgs({opened: false})}>Close</Button>
          </Group>
        </Stack>
      </Modal>
    </Center>
  );
};

/**
 * Mantine [Modal](https://mantine.dev/core/modal/) component stories.
 */
const meta: Meta<typeof Modal> = {
  title: 'Common/Modal',
  component: Modal,
  render: RenderModal,
  argTypes: {
    opened: {
      description: 'Modal opened state',
      type: 'boolean',
    },
    size: {
      description: 'Modal size - influences the width of the modal, height depends on the content',
      type: 'string',
      control: {
        type: 'select',
      },
      options: ['auto', 'xs', 'sm', 'md', 'lg', 'xl', '50%', '75%', '100%'],
    },
    fullScreen: {
      description: 'Modal fullscreen state',
      type: 'boolean',
    },
    centered: {
      description: 'Center modal vertically on the viewport',
      type: 'boolean',
    },
    withCloseButton: {
      description: 'Render close button',
      type: 'boolean',
    },
    title: {
      description: 'Modal title',
      type: 'string',
    },
  },
  args: {
    opened: false,
    closeOnClickOutside: true,
    withCloseButton: true,
    title: 'Modal title',
    centered: false,
    size: 'md',
    fullScreen: false,
  },
};

type Story = StoryObj<typeof Modal>;

export const Basic: Story = {
  args: {},
};

export default meta;
