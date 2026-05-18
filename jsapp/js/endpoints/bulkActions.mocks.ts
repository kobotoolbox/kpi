import { http, HttpResponse, type PathParams } from 'msw'
import type { BulkActionListResponse } from '#/api/models/bulkActionListResponse'
import bulkActionFactory from './bulkAction.factory'

/**
 * Mock API for bulk actions list. Use it in Storybook tests in `parameters.msw.handlers.bulkActions`.
 */

const bulkActionsMock = (override?: Partial<BulkActionListResponse>) =>
  http.get<PathParams<'uidAsset'>, never, BulkActionListResponse>(
    '/api/v2/assets/:uidAsset/advanced-features/bulk-actions/',
    () =>
      HttpResponse.json({
        ...defaultBulkActionsResponse,
        ...override,
        results: override?.results ?? defaultBulkActionsResponse.results,
      }),
  )

export default bulkActionsMock

const defaultBulkActionsResponse: BulkActionListResponse = {
  count: 1,
  next: null,
  previous: null,
  results: [bulkActionFactory('uuid:mock-uuid-1', 'fr')],
}
