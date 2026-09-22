// Factory for minimal SubmissionResponse with audio and transcript
import type { SubmissionResponse } from '#/dataInterface'
import { addDefaultUuidPrefix } from '#/utils'

/**
 * Creates a minimal SubmissionResponse for a form with no questions.
 *
 * The result models a submission that was never edited, so `meta/rootUuid` and `meta/instanceID` both follow `_uuid`.
 * Override `meta/rootUuid` to model an edited one, where `_uuid` has moved on and the two no longer match.
 *
 * Note: NOT migrated to Orval because SubmissionResponse is a legacy type
 * defined in dataInterface.ts, not in the OpenAPI schema. It represents
 * dynamic form submission data with arbitrary question fields, which cannot
 * be statically typed in OpenAPI/Orval.
 *
 * @param testId - Id of the submission
 * @param overrides - For overriding any property of the submission
 */
export default function assetDataFactory(
  testId = 123,
  overrides: Partial<SubmissionResponse> = {},
): SubmissionResponse {
  const uuid = overrides._uuid || `mock-uuid-${testId}`

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
    _uuid: uuid,
    'meta/rootUuid': addDefaultUuidPrefix(uuid),
    _validation_status: {},
    _xform_id_string: 'mock-xform-id',
    'formhub/uuid': `mock-formhub-uuid-${testId}`,
    'meta/instanceID': addDefaultUuidPrefix(uuid),
    ...overrides,
  }
}
