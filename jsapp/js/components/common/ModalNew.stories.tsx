import type { ModalProps } from '@mantine/core'
import { Center, Group, Stack, Text } from '@mantine/core'
import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { useArgs } from 'storybook/preview-api'
import ButtonNew from './ButtonNew'
import ModalNew from './ModalNew'

const RenderModal = ({ ...args }: ModalProps) => {
  const [{ opened }, updateArgs] = useArgs()

  return (
    <Center w={400} h={80}>
      <ButtonNew onClick={() => updateArgs({ opened: !opened })}>Open modal</ButtonNew>
      <ModalNew {...args} onClose={() => updateArgs({ opened: !opened })}>
        <Stack>
          <Text p='md'>Example modal content. Press esc, click outside or close button to close.</Text>
          <Group justify='flex-end'>
            <ButtonNew variant='danger'>Won&apos;t close</ButtonNew>
            <ButtonNew onClick={() => updateArgs({ opened: false })}>Close</ButtonNew>
          </Group>
        </Stack>
      </ModalNew>
    </Center>
  )
}

/**
 * Mantine [Modal](https://mantine.dev/core/modal/) wrapper component stories.
 */
const meta: Meta<typeof ModalNew> = {
  title: 'Design system/ModalNew',
  component: ModalNew,
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
  parameters: { a11y: { disable: true } },
}

type Story = StoryObj<typeof ModalNew>

export const Basic: Story = {
  args: {},
}

export default meta
