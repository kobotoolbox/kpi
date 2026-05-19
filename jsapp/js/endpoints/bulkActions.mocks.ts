import { http, HttpResponse, type PathParams } from 'msw'
import { endpoints } from '#/api.endpoints'
import type { BulkActionListResponse } from '#/api/models/bulkActionListResponse'
import bulkActionFactory from './bulkAction.factory'

/**
 * Mock API for bulk actions list. Use it in Storybook tests in `parameters.msw.handlers.bulkActions`.
 */

const bulkActionsMock = (assetUid = 'uuid:mock-uuid-1', override?: Partial<BulkActionListResponse>) =>
  http.get<PathParams<'uid'>, never, BulkActionListResponse>(
    endpoints.ASSET_ADVANCED_FEATURES_BULK_ACTIONS,
    ({ params }) => {
      // // Only respond for the correct assetUid
      // if (params.uid !== assetUid) return undefined
      return HttpResponse.json({
        ...defaultBulkActionsResponse,
        ...override,
        count: override?.results?.length ?? defaultBulkActionsResponse.count,
        results: override?.results ?? defaultBulkActionsResponse.results,
      })
    },
  )

export default bulkActionsMock

const defaultBulkActionsResponse: BulkActionListResponse = {
  count: 1,
  next: null,
  previous: null,
  results: [bulkActionFactory('uuid:mock-uuid-1', 'fr')],
}
