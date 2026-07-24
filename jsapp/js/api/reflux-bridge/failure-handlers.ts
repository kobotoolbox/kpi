import { actions } from '#/actions'
import { endpoints } from '#/api.endpoints'
import { type BridgeFailureHandler, SpecializedAssetPatchField } from './shared'

/**
 * Response-time failure handlers. Keep this table focused on legacy `*.failed` callbacks.
 */
export const BRIDGE_FAILURE_HANDLERS: ReadonlyArray<BridgeFailureHandler> = [
  {
    endpoint: `PATCH ${endpoints.ASSET_URL}`,
    refluxAction: 'actions.resources.updateAsset.failed',
    matches: ({ assetUid, requestBody }) =>
      Boolean(
        assetUid && requestBody && !Object.values(SpecializedAssetPatchField).some((field) => field in requestBody),
      ),
    run: ({ legacyFailurePayload }) => {
      actions.resources.updateAsset.failed(legacyFailurePayload)
    },
  },
  {
    endpoint: `PATCH ${endpoints.ASSET_URL}`,
    refluxAction: 'actions.reports.setStyle.failed',
    matches: ({ assetUid, requestBody }) => Boolean(assetUid && requestBody && 'report_styles' in requestBody),
    run: ({ legacyFailurePayload }) => {
      actions.reports.setStyle.failed(legacyFailurePayload)
    },
  },
  {
    endpoint: `PATCH ${endpoints.ASSET_URL}`,
    refluxAction: 'actions.reports.setCustom.failed',
    matches: ({ assetUid, requestBody }) => Boolean(assetUid && requestBody && 'report_custom' in requestBody),
    run: ({ legacyFailurePayload }) => {
      actions.reports.setCustom.failed(legacyFailurePayload)
    },
  },
  {
    endpoint: `PATCH ${endpoints.ASSET_URL}`,
    refluxAction: 'actions.map.setMapStyles.failed',
    matches: ({ assetUid, requestBody }) => Boolean(assetUid && requestBody && 'map_styles' in requestBody),
    run: ({ legacyFailurePayload }) => {
      actions.map.setMapStyles.failed(legacyFailurePayload)
    },
  },
  {
    endpoint: `POST ${endpoints.ASSETS_URL}`,
    refluxAction: 'actions.resources.createResource.failed | actions.resources.cloneAsset.failed',
    matches: ({ pathname }) => pathname === endpoints.ASSETS_URL,
    run: ({ requestBody, legacyFailurePayload }) => {
      // Same endpoint powers both create and clone, so branch by request body.
      if (typeof requestBody?.clone_from === 'string' && requestBody.clone_from.length > 0) {
        actions.resources.cloneAsset.failed(legacyFailurePayload)
        return
      }

      actions.resources.createResource.failed(legacyFailurePayload)
    },
  },
  {
    endpoint: `DELETE ${endpoints.ASSET_URL}`,
    refluxAction: 'actions.resources.deleteAsset.failed',
    matches: ({ assetUid }) => Boolean(assetUid),
    run: ({ assetUid }) => {
      if (assetUid) {
        // Intentional difference vs legacy Reflux flow: this bridge handler emits only `deleteAsset.failed` and does
        // not replicate the old inline alert. React-query code is expected to handle user-facing errors.
        actions.resources.deleteAsset.failed({ uid: assetUid, assetType: '' })
      }
    },
  },
  {
    endpoint: 'POST /api/v2/imports/',
    refluxAction: 'actions.resources.createImport.failed',
    matches: ({ pathname }) => pathname === '/api/v2/imports/',
    run: ({ legacyFailurePayload }) => {
      actions.resources.createImport.failed(legacyFailurePayload)
    },
  },
  {
    endpoint: `POST ${endpoints.ASSET_DEPLOYMENT_URL}`,
    refluxAction: 'actions.resources.deployAsset.failed',
    matches: ({ deploymentAssetUid }) => Boolean(deploymentAssetUid),
    run: ({ legacyFailurePayload }) => {
      actions.resources.deployAsset.failed(legacyFailurePayload, false)
    },
  },
  {
    // PATCH /deployment/ is overloaded: `version_id` means redeploy, otherwise it is set-active.
    endpoint: `PATCH ${endpoints.ASSET_DEPLOYMENT_URL}`,
    refluxAction: 'actions.resources.deployAsset.failed (redeployment)',
    matches: ({ deploymentAssetUid, requestBody }) =>
      Boolean(deploymentAssetUid && requestBody && 'version_id' in requestBody),
    run: ({ legacyFailurePayload }) => {
      actions.resources.deployAsset.failed(legacyFailurePayload, true)
    },
  },
  {
    endpoint: `PATCH ${endpoints.ASSET_DEPLOYMENT_URL}`,
    refluxAction: 'actions.resources.setDeploymentActive.failed',
    matches: ({ deploymentAssetUid, requestBody }) =>
      Boolean(deploymentAssetUid && (!requestBody || !('version_id' in requestBody))),
    run: ({ legacyFailurePayload }) => {
      actions.resources.setDeploymentActive.failed(legacyFailurePayload)
    },
  },
]
