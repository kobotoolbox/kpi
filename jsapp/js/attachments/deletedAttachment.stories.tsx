import type { Meta, StoryObj } from '@storybook/react-webpack5'
import DeletedAttachment from './deletedAttachment.component'

const meta: Meta<typeof DeletedAttachment> = {
  title: 'Components/DeletedAttachment',
  component: DeletedAttachment,
  parameters: { a11y: { test: 'todo' } },
}

type Story = StoryObj<typeof DeletedAttachment>

export const Basic: Story = {}

export default meta
