import { actions } from '#/actions'
import { endpoints } from '#/api.endpoints'
import { type BridgeStartHandler, SpecializedAssetPatchField } from './shared'

/**
 * Request-time lifecycle handlers.
 *
 * Keep this table limited to callbacks that must fire before the request is
 * sent, such as legacy `started` actions.
 */
export const BRIDGE_START_HANDLERS: ReadonlyArray<BridgeStartHandler> = [
  {
    endpoint: `PATCH ${endpoints.ASSET_URL}`,
    refluxAction: 'actions.map.setMapStyles.started',
    matches: ({ assetUid, requestBody }) =>
      Boolean(assetUid && requestBody && SpecializedAssetPatchField.MapStyles in requestBody),
    run: ({ assetUid, requestBody }) => {
      // Legacy map style flow still relies on `started` for immediate UI state.
      actions.map.setMapStyles.started(assetUid as string, requestBody?.[SpecializedAssetPatchField.MapStyles])
    },
  },
]
