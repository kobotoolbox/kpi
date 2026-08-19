import { modals } from '@mantine/modals'
import BulkEditSubmissionsForm from './bulkEditSubmissionsForm'
import {AssetResponse, SubmissionResponse} from '#/dataInterface'

export interface OpenBulkEditSubmissionsFormProps {
  asset: AssetResponse
  /**
   * submissions data (all user responses)
   */
  data: SubmissionResponse[]
  /**
   * number of all submissions
   */
  totalSubmissions: number
  /**
   * list of ids of submissions selected for bulk editing
   */
  selectedSubmissions: string[] | number[] | string | number
  onRequestClose: () => void
}
export type OpenBulkEditSubmissionsFormArgs = Omit<OpenBulkEditSubmissionsFormProps, 'onRequestClose'>

export default function openDataAttachmentColumnsModal(args: OpenBulkEditSubmissionsFormArgs) {
  const modalId = modals.open({
    title: t('Import data from ##SOURCE_NAME##').replace('##SOURCE_NAME##', ''),
    size: 'xl',
    children: (
      <BulkEditSubmissionsForm
        onRequestClose={() => {
          modals.close(modalId)
        }}
        {...args}
      />
    ),
  })
}
