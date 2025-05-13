import { http, HttpResponse, type PathParams } from 'msw'
import { endpoints } from '#/api.endpoints'
import type { AssetHistoryActionsResponse } from '#/components/activity/activity.constants'
import { mockAssetUid } from './assetHistory.mock'

/**
 * Mock API for listing all available history actions. Use it in Storybook tests in `parameters.msw.handlers[]`.
 * Uses same assetUid as assetHistory mock.
 */
const assetHistoryMock = http.get<PathParams<'limit' | 'offset' | 'q'>, never, AssetHistoryActionsResponse>(
  endpoints.ASSET_HISTORY_ACTIONS.replace(':asset_uid', mockAssetUid),
  () => HttpResponse.json(assetHistoryActionsResponse),
)
export default assetHistoryMock

const assetHistoryActionsResponse: AssetHistoryActionsResponse = {
  actions: [
    'disallow-anonymous-submissions',
    'add-media',
    'add-submission',
    'allow-anonymous-submissions',
    'modify-user-permissions',
    'update-content',
    'deploy',
    'delete-submission',
  ],
}
