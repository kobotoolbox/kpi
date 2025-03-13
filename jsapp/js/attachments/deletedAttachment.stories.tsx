import type { Meta, StoryObj } from '@storybook/react'
import DeletedAttachment from './deletedAttachment.component'

const RenderDeletedAttachment = () => {
  return <DeletedAttachment />
}

const meta: Meta<typeof DeletedAttachment> = {
  title: 'Attachments/DeletedAttachment',
  component: DeletedAttachment,
  render: RenderDeletedAttachment,
}

type Story = StoryObj<typeof DeletedAttachment>

export const Basic: Story = {}

export default meta
