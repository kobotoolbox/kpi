import { modals } from '@mantine/modals'
import DataAttachmentColumnsForm, { type DataAttachmentColumnsFormProps } from './dataAttachmentColumnsForm'

export type OpenDataAttachmentColumnsModalArgs = Omit<DataAttachmentColumnsFormProps, 'onRequestClose'>
export default function openDataAttachmentColumnsModal(args: OpenDataAttachmentColumnsModalArgs) {
  const modalId = modals.open({
    title: t('Import data from ##SOURCE_NAME##').replace('##SOURCE_NAME##', args.source.name),
    size: 'lg',
    children: (
      <DataAttachmentColumnsForm
        onRequestClose={() => {
          modals.close(modalId)
        }}
        {...args}
      />
    ),
  })
}
