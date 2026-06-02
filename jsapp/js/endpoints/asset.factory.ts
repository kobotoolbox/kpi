// Factory for minimal AssetResponse with audio question and transcript support
import { AssetTypeName } from '#/constants'
import type { AssetResponse } from '#/dataInterface'

/**
 * Creates a minimal AssetResponse for a form with no questions
 * @param overrides - For overriding any property of the asset
 */
export default function assetFactory(overrides: Partial<AssetResponse> = {}): AssetResponse {
  return {
    url: '',
    owner: '',
    owner__username: '',
    owner_label: '',
    last_modified_by: null,
    date_created: '',
    summary: {},
    date_modified: '',
    version_id: null,
    has_deployment: false,
    deployed_version_id: null,
    deployment__active: false,
    deployment__submission_count: 0,
    deployment_status: 'deployed',
    downloads: [],
    uid: 'mock-asset-uid',
    kind: 'form',
    assignable_permissions: [],
    effective_permissions: [],
    data: '',
    children: { count: 0 },
    content: {
      survey: [],
      choices: [],
    },
    subscribers_count: 0,
    status: '',
    access_types: null,
    project_ownership: null,
    parent: null,
    settings: {},
    asset_type: AssetTypeName.survey,
    report_styles: { default: {}, specified: {}, kuid_names: {} },
    report_custom: {},
    map_styles: {},
    map_custom: {},
    tag_string: '',
    name: 'Test form',
    permissions: [],
    export_settings: [],
    data_sharing: {},
    files: [],
    ...overrides,
  }
}
