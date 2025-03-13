import type { Meta, StoryObj } from '@storybook/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AttachmentActionsDropdown from './AttachmentActionsDropdown'
import { assetWithImage, assetWithImageSubmission } from './AttachmentActionsDropdown.mocks'

const mockQueryClient = new QueryClient()
const mockAsset = assetWithImage
const mockSubmission = assetWithImageSubmission
const mockAttachmentId = assetWithImageSubmission._attachments[0].id

const meta: Meta<typeof AttachmentActionsDropdown> = {
  title: 'Attachments/AttachmentActionsDropdown',
  component: AttachmentActionsDropdown,
  argTypes: {
    asset: { control: 'object' },
    submissionData: { control: 'object' },
    attachmentId: { control: 'number' },
    onDeleted: { action: 'onDeleted' },
  },
  args: {},
  render: (args) => (
    <div>
      <img src='https://fakeimg.pl/300/' alt='some attachment' />
      <AttachmentActionsDropdown {...args} />
    </div>
  ),
  // We need to provide `queryClient` for the component to work.
  decorators: [(Story) => <QueryClientProvider client={mockQueryClient}>{Story()}</QueryClientProvider>],
}

export default meta

export const Default: StoryObj<typeof AttachmentActionsDropdown> = {
  args: {
    asset: mockAsset,
    attachmentId: mockAttachmentId,
    submissionData: mockSubmission,
    onDeleted: () => console.log('Attachment deleted'),
  },
}
