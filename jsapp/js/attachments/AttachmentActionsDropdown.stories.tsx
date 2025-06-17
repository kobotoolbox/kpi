import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { queryClientDecorator } from '#/query/queryClient.mocks'
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
      <div
        style={{
          width: '300px',
          height: '300px',
          padding: '20px',
          lineHeight: '50px',
          textAlign: 'justify',
          fontSize: '50px',
          color: 'lightcoral',
          background: 'radial-gradient(circle, pink, blanchedalmond, thistle, pink, lavender, lavenderblush)',
          display: 'inline-block',
          verticalAlign: 'middle',
          fontStyle: 'italic',
          fontWeight: 900,
        }}
      >
        If you fight fire with fire, fire is guaranteed to win
      </div>
      <AttachmentActionsDropdown {...args} />
    </div>
  ),
  decorators: [queryClientDecorator],
  parameters: { a11y: { test: 'todo' } },
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
