import { http, HttpResponse, type PathParams } from 'msw'
import { endpoints } from '#/api.endpoints'
import type { PaginatedResponse, SubmissionResponse } from '#/dataInterface'
import { submissionWithNestedSupplementalDetails } from '../components/submissions/submissionUtils.mocks'

/**
 * MSW handler factory for /api/v2/assets/:uid/data/ endpoint.
 * Returns a paginated response with one submission matching the assetWithNestedSupplementalDetails.
 * Accepts an optional override for customizing the response.
 */

const assetDataMock = (assetUid: string, override?: Partial<PaginatedResponse<SubmissionResponse>>) => [
  http.get<PathParams<'limit' | 'start' | 'q'>, never, PaginatedResponse<SubmissionResponse>>(
    endpoints.ASSET_DATA_URL.replace(':uid', assetUid),
    () =>
      HttpResponse.json({
        count: 1,
        next: null,
        previous: null,
        results: [submissionWithNestedSupplementalDetails],
        ...override,
      }),
  ),
]

export default assetDataMock
