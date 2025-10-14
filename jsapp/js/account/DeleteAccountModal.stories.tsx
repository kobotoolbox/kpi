import { Button, Center, type ModalProps } from '@mantine/core'
import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { useArgs } from 'storybook/internal/preview-api'
import DeleteAccountModal from './DeleteAccountModal'

const RenderModal = ({ ...args }: ModalProps) => {
  const [{ opened }, updateArgs] = useArgs()

  return (
    <Center w={400} h={80}>
      <Button onClick={() => updateArgs({ opened: !opened })}>Open modal</Button>
      <DeleteAccountModal {...args} onClose={() => updateArgs({ opened: !opened })} />
    </Center>
  )
}

const meta: Meta<typeof DeleteAccountModal> = {
  title: 'Components/DeleteAccountModal',
  component: DeleteAccountModal,
  render: RenderModal,
  argTypes: {
    opened: {
      description: 'Modal opened state',
      type: 'boolean',
    },
  },
  args: {
    opened: false,
  },
  parameters: {
    a11y: { test: 'todo' },
  },
}

export default meta
type Story = StoryObj<typeof DeleteAccountModal>

export const Default: Story = {}
