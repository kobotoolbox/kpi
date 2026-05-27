// Factory for minimal SubmissionResponse with audio and transcript
import type { SubmissionResponse } from '#/dataInterface'

/**
 * Creates a minimal SubmissionResponse for a form with no questions.
 * @param testId - Id of the submission
 * @param overrides - For overriding any property of the submission
 */
export default function assetDataFactory(
  testId = 123,
  overrides: Partial<SubmissionResponse> = {},
): SubmissionResponse {
  return {
    _id: testId,
    __version__: 'mock-version',
    _attachments: [],
    _bamboo_dataset_id: '',
    _geolocation: [null, null],
    _notes: [],
    _status: 'submitted_via_web',
    _submission_time: '2026-05-18T12:00:00',
    _submitted_by: null,
    _tags: [],
    _uuid: `mock-uuid-${testId}`,
    'meta/rootUuid': `uuid:mock-uuid-${testId}`,
    _validation_status: {},
    _xform_id_string: 'mock-xform-id',
    'formhub/uuid': `mock-formhub-uuid-${testId}`,
    'meta/instanceID': `uuid:mock-uuid-${testId}`,
    ...overrides,
  }
}
