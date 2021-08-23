interface FailResponse {
  responseJSON: {
    detail: string
  }
  responseText: string
  status: number
  statusText: string
}

// TODO: most of these could be changed into ENUMS from just strings (e.g. `type`)
interface SurveyRow {
  $autoname: string
  $kuid: string
  calculation: string
  label: string[]
  hint?: string[]
  name: string
  required: boolean
  type: string
  _isRepeat?: boolean
  appearance?: string
  "kobo--matrix_list"?: string
  "kobo--rank-constraint-message"?: string
  "kobo--rank-items"?: string
  "kobo--score-choices"?: string
}

interface AssignablePermission {
  url: string
  label: string
}

interface AssignablePermissionPartial extends AssignablePermission {
  label: {
    default: string
    view_submissions: string
    change_submissions: string
    delete_submissions: string
    validate_submissions: string
  }
}

interface Permission {
  url: string
  user: string
  permission: string
  label: string
}

interface ExportSetting {
  uid: string
  url: string
  name: string
  date_modified: string
  export_settings: {
    lang: string
    type: string
    fields: string[]
    group_sep: string
    xls_types: boolean
    multiple_select: string
    hierarchy_in_labels: boolean
    fields_from_all_versions: boolean
  }
}

interface AssetContentSettings {
  name?: string
  version?: string
  id_string?: string
  style?: string
  form_id?: string
  title?: string
}

interface AssetContent {
  schema: string
  survey: SurveyRow[]
  settings: AssetContentSettings | AssetContentSettings[]
  translated: string[]
  translations: string[]
}

// NOTE: asset comes in different flavours: one with all the information and one without `content`
interface AssetResponse {
  url: string
  owner: string
  owner__username: string
  parent: string | null
  settings: {
    "data-table"?: {
      "frozen-column"?: string
      "show-hxl-tags"?: boolean
      "show-group-name"?: boolean
      "translation-index"?: number
    }
  }
  asset_type: string
  date_created: string
  summary: {
    geo: boolean
    labels: string[]
    columns: string[]
    lock_all: boolean
    lock_any: boolean
    languages: string[]
    row_count: number
    default_translation: string
  }
  date_modified: string
  version_id: string
  version__content_hash: string
  version_count: number
  has_deployment: boolean
  deployed_version_id: string
  deployed_versions: {
    count: number
    next: null | string
    previous: null | string
    results: {
      uid: string
      url: string
      content_hash: string
      date_deployed: string
      date_modified: string
    }[]
  }
  deployment__identifier: string
  deployment__links: {
    url: string
    single_url: string
    single_once_url: string
    offline_url: string
    preview_url: string
    iframe_url: string
    single_iframe_url: string
    single_once_iframe_url: string
  }
  deployment__active: boolean
  deployment__data_download_links: {
    xls_legacy: string
    csv_legacy: string
    zip_legacy: string
    kml_legacy: string
    xls: string
    csv: string
  }
  deployment__submission_count: number
  report_styles: {
    default: {}
    specified: {
      end: {}
      start: {}
      Your_name: {}
      __version__: {}
    }
    kuid_names: {
      end: string
      start: string
      Your_name: string
      __version__: string
    }
  }
  report_custom: {
    [reportName: string]: {
      crid: string
      name: string
      questions: string[]
      reportStyle: {
        groupDataBy: string
        report_type: string
        report_colors: string[]
        translationIndex: number
      }
    }
  }
  map_styles: {}
  map_custom: {}
  content?: AssetContent
  downloads: {
    format: string
    url: string
  }[]
  embeds: {
    format: string
    url: string
  }[]
  koboform_link: string
  xform_link: string
  hooks_link: string
  tag_string: string
  uid: string
  kind: string
  xls_link: string
  name: string
  assignable_permissions: Array<AssignablePermission|AssignablePermissionPartial>
  permissions: Permission[]
  exports: string
  export_settings: ExportSetting[]
  data: string
  children: {
    count: number
  }
  subscribers_count: number
  status: string
  access_types: string[]|null
  data_sharing: {}
  paired_data: string
}
