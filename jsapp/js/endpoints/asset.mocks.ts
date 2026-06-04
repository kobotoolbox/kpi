import { http, HttpResponse } from 'msw'
import { endpoints } from '#/api.endpoints'
import { AssetTypeName, QuestionTypeName } from '#/constants'
import type { AssetResponse } from '#/dataInterface'

interface AssetPatchMockOptions<TPayload> {
  asset: AssetResponse
  applyPatch: (asset: AssetResponse, payload: TPayload) => void
  onPatch?: (asset: AssetResponse, payload: TPayload) => void
}

const cloneAsset = (asset: AssetResponse): AssetResponse => JSON.parse(JSON.stringify(asset)) as AssetResponse

/**
 * Mock API for single asset detail. Use in Storybook tests in `parameters.msw.handlers.asset`.
 *
 * Usage: assetMock() for default, or assetMock({ name: 'override' }) for custom.
 */
const assetMock = (assetUid: string, override?: Partial<AssetResponse>) =>
  http.get(endpoints.ASSET_URL, ({ params }) => {
    // Only respond for the correct assetUid
    if (params.uid !== assetUid) return undefined
    return HttpResponse.json({
      ...defaultMockResponse,
      ...override,
      uid: params.uid || override?.uid || defaultMockResponse.uid,
    })
  })

export const assetPatchMock = <TPayload>({
  asset,
  applyPatch,
  onPatch,
}: AssetPatchMockOptions<TPayload>) => {
  const currentAsset = cloneAsset(asset)

  return http.patch(endpoints.ASSET_URL, async ({ params, request }) => {
    if (params.uid !== asset.uid) {
      return HttpResponse.json({ detail: 'asset not found' }, { status: 404 })
    }

    const payload = (await request.json()) as TPayload

    applyPatch(currentAsset, payload)

    const responseAsset = cloneAsset(currentAsset)
    onPatch?.(responseAsset, payload)

    return HttpResponse.json(responseAsset)
  })
}

export const defaultMockResponse: AssetResponse = {
  url: 'http://kf.kobo.local/api/v2/assets/abam8JiJ3hHTW3EYp6Tpb5/',
  owner: 'http://kf.kobo.local/api/v2/users/zefir/',
  owner__username: 'zefir',
  parent: null,
  settings: {
    sector: {},
    country: [],
    description: '',
    collects_pii: null,
    organization: '',
    country_codes: [],
    operational_purpose: null,
  },
  asset_type: AssetTypeName.survey,
  files: [],
  summary: {
    geo: false,
    labels: ['Your name'],
    columns: ['type', 'label', 'required'],
    lock_all: false,
    lock_any: false,
    languages: [],
    row_count: 1,
    name_quality: {
      ok: 1,
      bad: 0,
      good: 0,
      total: 1,
      firsts: { ok: { name: 'Your_name', index: 1, label: ['Your name'] } },
    },
    default_translation: null,
  },
  date_created: '2025-09-09T21:08:44.296979Z',
  date_modified: '2025-09-09T21:09:04.827003Z',
  version_id: 'vt8TMvyLRCyv26nQLcbGBi',
  version__content_hash: '822573fdb551228b65ef80359b4499e62421adde',
  version_count: 3,
  has_deployment: false,
  deployed_version_id: null,
  deployed_versions: { count: 0, next: null, previous: null, results: [] },
  deployment__links: {},
  deployment__active: false,
  deployment__submission_count: 0,
  deployment_status: 'draft',
  report_styles: { default: {}, specified: { wb1gg11: {} }, kuid_names: { wb1gg11: 'wb1gg11' } },
  report_custom: {},
  advanced_features: {},
  analysis_form_json: { additional_fields: [] },
  map_styles: {},
  map_custom: {},
  content: {
    schema: '1',
    survey: [
      {
        type: QuestionTypeName.text,
        $kuid: 'wb1gg11',
        label: ['Your name'],
        $xpath: 'Your_name',
        required: false,
        $autoname: 'Your_name',
      },
    ],
    settings: {},
    translated: ['label'],
    translations: [null],
  },
  downloads: [
    { format: 'xls', url: 'http://kf.kobo.local/api/v2/assets/abam8JiJ3hHTW3EYp6Tpb5.xls' },
    { format: 'xml', url: 'http://kf.kobo.local/api/v2/assets/abam8JiJ3hHTW3EYp6Tpb5.xml' },
  ],
  embeds: [
    { format: 'xls', url: 'http://kf.kobo.local/api/v2/assets/abam8JiJ3hHTW3EYp6Tpb5/xls/' },
    { format: 'xform', url: 'http://kf.kobo.local/api/v2/assets/abam8JiJ3hHTW3EYp6Tpb5/xform/' },
  ],
  xform_link: 'http://kf.kobo.local/api/v2/assets/abam8JiJ3hHTW3EYp6Tpb5/xform/',
  hooks_link: 'http://kf.kobo.local/api/v2/assets/abam8JiJ3hHTW3EYp6Tpb5/hooks/',
  tag_string: '',
  uid: 'abam8JiJ3hHTW3EYp6Tpb5',
  kind: 'asset',
  xls_link: 'http://kf.kobo.local/api/v2/assets/abam8JiJ3hHTW3EYp6Tpb5/xls/',
  name: 'minimal asset first',
  assignable_permissions: [
    { url: 'http://kf.kobo.local/api/v2/permissions/view_asset/', label: 'View form' },
    { url: 'http://kf.kobo.local/api/v2/permissions/change_asset/', label: 'Edit form' },
    { url: 'http://kf.kobo.local/api/v2/permissions/manage_asset/', label: 'Manage project' },
    { url: 'http://kf.kobo.local/api/v2/permissions/add_submissions/', label: 'Add submissions' },
    { url: 'http://kf.kobo.local/api/v2/permissions/view_submissions/', label: 'View submissions' },
    {
      url: 'http://kf.kobo.local/api/v2/permissions/partial_submissions/',
      label: {
        default: 'Act on submissions only from specific users',
        view_submissions: 'View submissions only from specific users',
        change_submissions: 'Edit submissions only from specific users',
        delete_submissions: 'Delete submissions only from specific users',
        validate_submissions: 'Validate submissions only from specific users',
      },
    },
    { url: 'http://kf.kobo.local/api/v2/permissions/change_submissions/', label: 'Edit submissions' },
    { url: 'http://kf.kobo.local/api/v2/permissions/delete_submissions/', label: 'Delete submissions' },
    { url: 'http://kf.kobo.local/api/v2/permissions/validate_submissions/', label: 'Validate submissions' },
  ],
  permissions: [
    {
      url: 'http://kf.kobo.local/api/v2/assets/abam8JiJ3hHTW3EYp6Tpb5/permission-assignments/pvSrj5oiVFK2VrhNRXt2yr/',
      user: 'http://kf.kobo.local/api/v2/users/zefir/',
      permission: 'http://kf.kobo.local/api/v2/permissions/add_submissions/',
      label: 'Add submissions',
    },
    {
      url: 'http://kf.kobo.local/api/v2/assets/abam8JiJ3hHTW3EYp6Tpb5/permission-assignments/p9UxbrXnf9KEWfEZdKfy49/',
      user: 'http://kf.kobo.local/api/v2/users/zefir/',
      permission: 'http://kf.kobo.local/api/v2/permissions/change_asset/',
      label: 'Edit form',
    },
    {
      url: 'http://kf.kobo.local/api/v2/assets/abam8JiJ3hHTW3EYp6Tpb5/permission-assignments/pmSFAQG4Zji9bxit9McKPY/',
      user: 'http://kf.kobo.local/api/v2/users/zefir/',
      permission: 'http://kf.kobo.local/api/v2/permissions/change_submissions/',
      label: 'Edit submissions',
    },
    {
      url: 'http://kf.kobo.local/api/v2/assets/abam8JiJ3hHTW3EYp6Tpb5/permission-assignments/pZTZtbdNcV4yQ9CMAB7BKo/',
      user: 'http://kf.kobo.local/api/v2/users/zefir/',
      permission: 'http://kf.kobo.local/api/v2/permissions/delete_submissions/',
      label: 'Delete submissions',
    },
    {
      url: 'http://kf.kobo.local/api/v2/assets/abam8JiJ3hHTW3EYp6Tpb5/permission-assignments/pSfM5nnZ4F4i32pwzQxtz9/',
      user: 'http://kf.kobo.local/api/v2/users/zefir/',
      permission: 'http://kf.kobo.local/api/v2/permissions/manage_asset/',
      label: 'Manage project',
    },
    {
      url: 'http://kf.kobo.local/api/v2/assets/abam8JiJ3hHTW3EYp6Tpb5/permission-assignments/pnZXygNRi4subXAeBTZuux/',
      user: 'http://kf.kobo.local/api/v2/users/zefir/',
      permission: 'http://kf.kobo.local/api/v2/permissions/validate_submissions/',
      label: 'Validate submissions',
    },
    {
      url: 'http://kf.kobo.local/api/v2/assets/abam8JiJ3hHTW3EYp6Tpb5/permission-assignments/pxbya4pDjbLY7pY4QSNxMU/',
      user: 'http://kf.kobo.local/api/v2/users/zefir/',
      permission: 'http://kf.kobo.local/api/v2/permissions/view_asset/',
      label: 'View form',
    },
    {
      url: 'http://kf.kobo.local/api/v2/assets/abam8JiJ3hHTW3EYp6Tpb5/permission-assignments/phL46hRUcpycdP55e7YYGF/',
      user: 'http://kf.kobo.local/api/v2/users/zefir/',
      permission: 'http://kf.kobo.local/api/v2/permissions/view_submissions/',
      label: 'View submissions',
    },
  ],
  effective_permissions: [
    { codename: 'change_metadata_asset' },
    { codename: 'change_asset' },
    { codename: 'validate_submissions' },
    { codename: 'manage_asset' },
    { codename: 'delete_submissions' },
    { codename: 'delete_asset' },
    { codename: 'view_asset' },
    { codename: 'view_submissions' },
    { codename: 'change_submissions' },
    { codename: 'add_submissions' },
  ],
  exports: 'http://kf.kobo.local/api/v2/assets/abam8JiJ3hHTW3EYp6Tpb5/exports/',
  export_settings: [],
  data: 'http://kf.kobo.local/api/v2/assets/abam8JiJ3hHTW3EYp6Tpb5/data/',
  children: { count: 0 },
  subscribers_count: 0,
  status: 'private',
  access_types: null,
  data_sharing: {},
  paired_data: 'http://kf.kobo.local/api/v2/assets/abam8JiJ3hHTW3EYp6Tpb5/paired-data/',
  project_ownership: null,
  owner_label: "zefir's MMO organization",
  last_modified_by: 'zefir',
}

export default assetMock
