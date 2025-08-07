import { ANY_ROW_TYPE_NAMES, AssetTypeName } from '#/constants'
import type { AssetResponse, SubmissionResponse } from '#/dataInterface'

export const assetWithImage: AssetResponse = {
  url: 'http://kf.kobo.local/api/v2/assets/aALUCUEKcgKk28owQo3LrA/',
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
    labels: ['Add a picture'],
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
      firsts: {
        ok: {
          name: 'Add_a_picture',
          index: 1,
          label: ['Add a picture'],
        },
      },
    },
    default_translation: null,
  },
  date_created: '2025-03-13T11:21:07.647839Z',
  date_modified: '2025-03-13T11:21:36.038403Z',
  date_deployed: '2025-03-13T11:21:36.019801Z',
  version_id: 'vXCTi4YUvJ8FuwgcdDMDki',
  version__content_hash: '82fcae2bf3933d231b963d6ef4dd37f853475ab5',
  version_count: 2,
  has_deployment: true,
  deployed_version_id: 'vXCTi4YUvJ8FuwgcdDMDki',
  deployed_versions: {
    count: 1,
    next: null,
    previous: null,
    results: [
      {
        uid: 'vXCTi4YUvJ8FuwgcdDMDki',
        url: 'http://kf.kobo.local/api/v2/assets/aALUCUEKcgKk28owQo3LrA/versions/vXCTi4YUvJ8FuwgcdDMDki/',
        content_hash: '82fcae2bf3933d231b963d6ef4dd37f853475ab5',
        date_deployed: '2025-03-13T11:21:36.016537Z',
        date_modified: '2025-03-13T11:21:36.016537Z',
      },
    ],
  },
  deployment__links: {
    url: 'http://ee.kobo.local/X63UWDPC',
    single_url: 'http://ee.kobo.local/single/X63UWDPC',
    single_once_url: 'http://ee.kobo.local/single/1b7edd93e9e4c47629868c8a8163a308',
    offline_url: 'http://ee.kobo.local/x/X63UWDPC',
    preview_url: 'http://ee.kobo.local/preview/X63UWDPC',
    iframe_url: 'http://ee.kobo.local/i/X63UWDPC',
    single_iframe_url: 'http://ee.kobo.local/single/i/X63UWDPC',
    single_once_iframe_url: 'http://ee.kobo.local/single/i/1b7edd93e9e4c47629868c8a8163a308',
  },
  deployment__active: true,
  deployment__data_download_links: {
    csv_legacy: 'http://kc.kobo.local/zefir/exports/aALUCUEKcgKk28owQo3LrA/csv/',
    csv: 'http://kc.kobo.local/zefir/reports/aALUCUEKcgKk28owQo3LrA/export.csv',
    kml_legacy: 'http://kc.kobo.local/zefir/exports/aALUCUEKcgKk28owQo3LrA/kml/',
    xls_legacy: 'http://kc.kobo.local/zefir/exports/aALUCUEKcgKk28owQo3LrA/xls/',
    xls: 'http://kc.kobo.local/zefir/reports/aALUCUEKcgKk28owQo3LrA/export.xlsx',
    zip_legacy: 'http://kc.kobo.local/zefir/exports/aALUCUEKcgKk28owQo3LrA/zip/',
  },
  deployment__submission_count: 1,
  deployment_status: 'deployed',
  report_styles: {
    default: {},
    specified: {
      gd0wv19: {},
    },
    kuid_names: {
      gd0wv19: 'gd0wv19',
    },
  },
  report_custom: {},
  advanced_features: {},
  advanced_submission_schema: {
    type: 'object',
    $description: 'no advanced features activated for this form',
  },
  analysis_form_json: {
    engines: {},
    additional_fields: [],
  },
  map_styles: {},
  map_custom: {},
  content: {
    schema: '1',
    survey: [
      {
        type: ANY_ROW_TYPE_NAMES.image,
        $kuid: 'gd0wv19',
        label: ['Add a picture'],
        $xpath: 'Add_a_picture',
        required: false,
        $autoname: 'Add_a_picture',
      },
    ],
    settings: {},
    translated: ['label'],
    translations: [null],
  },
  downloads: [
    {
      format: 'xls',
      url: 'http://kf.kobo.local/api/v2/assets/aALUCUEKcgKk28owQo3LrA.xls',
    },
    {
      format: 'xml',
      url: 'http://kf.kobo.local/api/v2/assets/aALUCUEKcgKk28owQo3LrA.xml',
    },
  ],
  embeds: [
    {
      format: 'xls',
      url: 'http://kf.kobo.local/api/v2/assets/aALUCUEKcgKk28owQo3LrA/xls/',
    },
    {
      format: 'xform',
      url: 'http://kf.kobo.local/api/v2/assets/aALUCUEKcgKk28owQo3LrA/xform/',
    },
  ],
  xform_link: 'http://kf.kobo.local/api/v2/assets/aALUCUEKcgKk28owQo3LrA/xform/',
  hooks_link: 'http://kf.kobo.local/api/v2/assets/aALUCUEKcgKk28owQo3LrA/hooks/',
  tag_string: '',
  uid: 'aALUCUEKcgKk28owQo3LrA',
  kind: 'asset',
  xls_link: 'http://kf.kobo.local/api/v2/assets/aALUCUEKcgKk28owQo3LrA/xls/',
  name: 'Small image project',
  assignable_permissions: [
    {
      url: 'http://kf.kobo.local/api/v2/permissions/view_asset/',
      label: 'View form',
    },
    {
      url: 'http://kf.kobo.local/api/v2/permissions/change_asset/',
      label: 'Edit form',
    },
    {
      url: 'http://kf.kobo.local/api/v2/permissions/manage_asset/',
      label: 'Manage project',
    },
    {
      url: 'http://kf.kobo.local/api/v2/permissions/add_submissions/',
      label: 'Add submissions',
    },
    {
      url: 'http://kf.kobo.local/api/v2/permissions/view_submissions/',
      label: 'View submissions',
    },
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
    {
      url: 'http://kf.kobo.local/api/v2/permissions/change_submissions/',
      label: 'Edit submissions',
    },
    {
      url: 'http://kf.kobo.local/api/v2/permissions/delete_submissions/',
      label: 'Delete submissions',
    },
    {
      url: 'http://kf.kobo.local/api/v2/permissions/validate_submissions/',
      label: 'Validate submissions',
    },
  ],
  permissions: [
    {
      url: 'http://kf.kobo.local/api/v2/assets/aALUCUEKcgKk28owQo3LrA/permission-assignments/pcAumEGxWPumiRiotggxP8/',
      user: 'http://kf.kobo.local/api/v2/users/AnonymousUser/',
      permission: 'http://kf.kobo.local/api/v2/permissions/add_submissions/',
      label: 'Add submissions',
    },
    {
      url: 'http://kf.kobo.local/api/v2/assets/aALUCUEKcgKk28owQo3LrA/permission-assignments/ppN82KMksMFmUBJiqZRpUj/',
      user: 'http://kf.kobo.local/api/v2/users/zefir/',
      permission: 'http://kf.kobo.local/api/v2/permissions/add_submissions/',
      label: 'Add submissions',
    },
    {
      url: 'http://kf.kobo.local/api/v2/assets/aALUCUEKcgKk28owQo3LrA/permission-assignments/phSpaAPcqEaTWCCXZpcVVi/',
      user: 'http://kf.kobo.local/api/v2/users/zefir/',
      permission: 'http://kf.kobo.local/api/v2/permissions/change_asset/',
      label: 'Edit form',
    },
    {
      url: 'http://kf.kobo.local/api/v2/assets/aALUCUEKcgKk28owQo3LrA/permission-assignments/pTGqsL9eQLgAcbQHKvBvvt/',
      user: 'http://kf.kobo.local/api/v2/users/zefir/',
      permission: 'http://kf.kobo.local/api/v2/permissions/change_submissions/',
      label: 'Edit submissions',
    },
    {
      url: 'http://kf.kobo.local/api/v2/assets/aALUCUEKcgKk28owQo3LrA/permission-assignments/p458sk4MGkRtvfSGf3yWYi/',
      user: 'http://kf.kobo.local/api/v2/users/zefir/',
      permission: 'http://kf.kobo.local/api/v2/permissions/delete_submissions/',
      label: 'Delete submissions',
    },
    {
      url: 'http://kf.kobo.local/api/v2/assets/aALUCUEKcgKk28owQo3LrA/permission-assignments/pqgKoy64qwztzVfSmg4hfV/',
      user: 'http://kf.kobo.local/api/v2/users/zefir/',
      permission: 'http://kf.kobo.local/api/v2/permissions/manage_asset/',
      label: 'Manage project',
    },
    {
      url: 'http://kf.kobo.local/api/v2/assets/aALUCUEKcgKk28owQo3LrA/permission-assignments/pyKd6Zp7BAmCAmLE9FySJK/',
      user: 'http://kf.kobo.local/api/v2/users/zefir/',
      permission: 'http://kf.kobo.local/api/v2/permissions/validate_submissions/',
      label: 'Validate submissions',
    },
    {
      url: 'http://kf.kobo.local/api/v2/assets/aALUCUEKcgKk28owQo3LrA/permission-assignments/pR2nuq5oJVscaUvDdm5o5c/',
      user: 'http://kf.kobo.local/api/v2/users/zefir/',
      permission: 'http://kf.kobo.local/api/v2/permissions/view_asset/',
      label: 'View form',
    },
    {
      url: 'http://kf.kobo.local/api/v2/assets/aALUCUEKcgKk28owQo3LrA/permission-assignments/pqhwwj6WKLvE4Sxi8EXmxW/',
      user: 'http://kf.kobo.local/api/v2/users/zefir/',
      permission: 'http://kf.kobo.local/api/v2/permissions/view_submissions/',
      label: 'View submissions',
    },
  ],
  effective_permissions: [
    {
      codename: 'change_asset',
    },
    {
      codename: 'change_submissions',
    },
    {
      codename: 'delete_submissions',
    },
    {
      codename: 'view_submissions',
    },
    {
      codename: 'manage_asset',
    },
    {
      codename: 'view_asset',
    },
    {
      codename: 'delete_asset',
    },
    {
      codename: 'validate_submissions',
    },
    {
      codename: 'add_submissions',
    },
  ],
  exports: 'http://kf.kobo.local/api/v2/assets/aALUCUEKcgKk28owQo3LrA/exports/',
  export_settings: [],
  data: 'http://kf.kobo.local/api/v2/assets/aALUCUEKcgKk28owQo3LrA/data/',
  children: {
    count: 0,
  },
  subscribers_count: 0,
  status: 'shared',
  access_types: null,
  data_sharing: {},
  paired_data: 'http://kf.kobo.local/api/v2/assets/aALUCUEKcgKk28owQo3LrA/paired-data/',
  project_ownership: null,
  owner_label: 'Test Korp Inc',
}

export const assetWithImageSubmission: SubmissionResponse = {
  _id: 67,
  'formhub/uuid': '1c0496e69e624ab6a265316eed7127c1',
  Add_a_picture: 'the-origin-of-the-world-12_21_57.jpg',
  __version__: 'vXCTi4YUvJ8FuwgcdDMDki',
  'meta/instanceID': 'uuid:d861c7c7-9c49-42cb-8652-cbe3b6c148ad',
  _xform_id_string: 'aALUCUEKcgKk28owQo3LrA',
  _uuid: 'd861c7c7-9c49-42cb-8652-cbe3b6c148ad',
  'meta/rootUuid': 'uuid:d861c7c7-9c49-42cb-8652-cbe3b6c148ad',
  _attachments: [
    {
      download_url: 'http://kf.kobo.local/api/v2/assets/aALUCUEKcgKk28owQo3LrA/data/67/attachments/22/',
      download_large_url: 'http://kf.kobo.local/api/v2/assets/aALUCUEKcgKk28owQo3LrA/data/67/attachments/22/large/',
      download_medium_url: 'http://kf.kobo.local/api/v2/assets/aALUCUEKcgKk28owQo3LrA/data/67/attachments/22/medium/',
      download_small_url: 'http://kf.kobo.local/api/v2/assets/aALUCUEKcgKk28owQo3LrA/data/67/attachments/22/small/',
      mimetype: 'image/jpeg',
      filename:
        'zefir/attachments/1c0496e69e624ab6a265316eed7127c1/d861c7c7-9c49-42cb-8652-cbe3b6c148ad/the-origin-of-the-world-12_21_57.jpg',
      uid: 'aALUCUEKcgKk28owQo3LrA',
      question_xpath: 'Add_a_picture',
    },
  ],
  _status: 'submitted_via_web',
  _geolocation: [null, null],
  _submission_time: '2025-03-13T11:21:58',
  _tags: [],
  _notes: [],
  _validation_status: {},
  _submitted_by: null,
  _supplementalDetails: {},
}
