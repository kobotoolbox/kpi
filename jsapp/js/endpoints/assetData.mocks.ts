import { http, HttpResponse, type PathParams } from 'msw'
import { endpoints } from '#/api.endpoints'
import type { PaginatedResponse, SubmissionResponse } from '#/dataInterface'
import assetDataFactory from './assetData.factory'

/**
 * MSW handler factory for /api/v2/assets/:uid/data/ endpoint.
 * Returns a paginated response with one submission, unless overriden.
 * @param assetUid
 * @param submissions - A list of `SubmissionResponse`s to be returned
 * @param override - Optional override for the paginated response
 */
export default function assetDataMockFactory(
  assetUid: string,
  submissions: SubmissionResponse[] = [assetDataFactory()],
  override: Partial<PaginatedResponse<SubmissionResponse>> = {},
) {
  return http.get<PathParams<'uid' | 'limit' | 'start' | 'q'>, never, PaginatedResponse<SubmissionResponse>>(
    endpoints.ASSET_DATA_URL,
    ({ params }) => {
      if (params.uid !== assetUid) return undefined
      return HttpResponse.json({
        count: submissions.length,
        next: null,
        previous: null,
        results: submissions,
        ...override,
      })
    },
  )
}
