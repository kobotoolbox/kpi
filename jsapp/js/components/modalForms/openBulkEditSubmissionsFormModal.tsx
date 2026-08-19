import { modals } from '@mantine/modals'
import ClampedTitle from '#/components/common/ClampedTitle'
import type { AssetResponse, SubmissionResponse } from '#/dataInterface'
import BulkEditSubmissionsForm from './bulkEditSubmissionsForm'

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
  /**
   * Reports the label of the question being edited, or `null` when the form is
   * back on the questions list. The form owns that navigation, so this is how
   * the modal title can follow it.
   */
  onSelectedQuestionChange: (questionLabel: string | null) => void
  onRequestClose: () => void
}
export type OpenBulkEditSubmissionsFormArgs = Omit<
  OpenBulkEditSubmissionsFormProps,
  'onRequestClose' | 'onSelectedQuestionChange'
>

export default function openDataAttachmentColumnsModal(args: OpenBulkEditSubmissionsFormArgs) {
  const count = Array.isArray(args.selectedSubmissions) ? args.selectedSubmissions.length : 1

  /** `questionLabel` is `null` while the form displays the questions list. */
  const getTitle = (questionLabel: string | null) => {
    if (questionLabel === null) {
      return t('Editing ##count## submission(s)').replace('##count##', count.toString())
    }
    // The question label is user provided, so it needs clamping.
    return (
      <ClampedTitle>
        {t('Editing "##question##" for ##count## submissions')
          .replace('##question##', questionLabel)
          .replace('##count##', count.toString())}
      </ClampedTitle>
    )
  }

  const modalId = modals.open({
    title: getTitle(null),
    size: 960, // Needs to be larger than 'xl'. 960 is the same max-width as modal--large
    children: (
      <BulkEditSubmissionsForm
        onSelectedQuestionChange={(questionLabel: string | null) => {
          modals.updateModal({ modalId, title: getTitle(questionLabel) })
        }}
        onRequestClose={() => {
          modals.close(modalId)
        }}
        {...args}
      />
    ),
  })
}
