import { modals } from '@mantine/modals'
import DataAttachmentColumnsForm, {DataAttachmentColumnsFormProps} from './dataAttachmentColumnsForm'

export type OpenDataAttachmentColumnsModalArgs = Omit<
  DataAttachmentColumnsFormProps,
  'onRequestClose'
>
export default function openDataAttachmentColumnsModal(
  args: OpenDataAttachmentColumnsModalArgs,
) {
  const modalId = modals.open({
    title: t('Columns to import'),
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
