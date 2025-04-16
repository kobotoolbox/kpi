import type { Meta, StoryObj } from '@storybook/react'
import DeletedAttachment from './deletedAttachment.component'

const meta: Meta<typeof DeletedAttachment> = {
  title: 'Components/DeletedAttachment',
  component: DeletedAttachment,
}

type Story = StoryObj<typeof DeletedAttachment>

export const Basic: Story = {}

export default meta
