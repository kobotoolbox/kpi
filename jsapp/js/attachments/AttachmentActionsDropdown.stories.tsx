import type { Meta, StoryObj } from '@storybook/react'
import { queryClientDecorator } from '#/query/queryClient.mock'
import AttachmentActionsDropdown from './AttachmentActionsDropdown'
import { assetWithImage, assetWithImageSubmission } from './AttachmentActionsDropdown.mocks'

const mockAsset = assetWithImage
const mockSubmission = assetWithImageSubmission
const mockAttachmentUid = assetWithImageSubmission._attachments[0].uid

const meta: Meta<typeof AttachmentActionsDropdown> = {
  title: 'Components/AttachmentActionsDropdown',
  component: AttachmentActionsDropdown,
  argTypes: {
    asset: { control: 'object' },
    submissionData: {
      control: 'object',
      description:
        'To see what happens when attachment is deleted, please add `is_deleted=true` flag to the attachment object in the data.',
    },
    attachmentUid: { control: 'text' },
    onDeleted: { action: 'onDeleted' },
  },
  args: {},
  render: (args) => (
    <div>
      <img src='https://fakeimg.pl/300/' alt='some attachment' />
      <AttachmentActionsDropdown {...args} />
    </div>
  ),
  decorators: [queryClientDecorator],
}

export default meta

export const Default: StoryObj<typeof AttachmentActionsDropdown> = {
  args: {
    asset: mockAsset,
    attachmentUid: mockAttachmentUid,
    submissionData: mockSubmission,
    onDeleted: () => console.log('Attachment deleted'),
  },
}
