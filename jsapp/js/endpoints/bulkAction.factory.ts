import { ActionIdEnum } from '#/api/models/actionIdEnum'
import type { BulkActionResponse } from '#/api/models/bulkActionResponse'
import { BulkActionResponseStatusEnum } from '#/api/models/bulkActionResponseStatusEnum'
import { BulkActionSubmissionStatusResponseStatusEnum } from '#/api/models/bulkActionSubmissionStatusResponseStatusEnum'
import type { LanguageCode } from '#/components/languages/languagesStore'

export default function bulkActionFactory(
  submissionUuid: string,
  languageCode: LanguageCode,
  overrides: Partial<BulkActionResponse> = {},
): BulkActionResponse {
  return {
    uid: 'bulk-action-uid',
    status: BulkActionResponseStatusEnum.in_progress,
    action_id: ActionIdEnum.automatic_google_transcription,
    question_xpath: 'Your_name',
    submission_uuids: [submissionUuid],
    submission_statuses: [
      {
        uuid: submissionUuid,
        status: BulkActionSubmissionStatusResponseStatusEnum.in_progress,
      },
    ],
    params: {
      language: languageCode,
    },
    progress: 0,
    created_by: {
      username: 'zefir',
    },
    date_created: '2026-01-01T00:00:00Z',
    date_modified: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}
