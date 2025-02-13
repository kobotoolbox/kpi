import cloneDeep from 'lodash.clonedeep';
import merge from 'lodash.merge';
import {
  AssetTypeName,
  GroupTypeBeginName,
  GroupTypeEndName,
  MetaQuestionTypeName,
  QuestionTypeName,
} from 'js/constants';
import type {AssetResponse} from 'js/dataInterface';
import {
  LOCK_ALL_PROP_NAME,
  LOCKING_PROFILE_PROP_NAME,
  LockingRestrictionName,
} from './lockingConstants';

/**
 * This is a minimal response from asset endpoin. The idea is to make it up
 * to date and extend in other test objects (rather than having those huge
 * lengthy JSONs).
 */
const minimalAssetResponse = {
  'url': 'http://kf.kobo.local/api/v2/assets/aBcDe12345/',
  'owner': 'http://kf.kobo.local/api/v2/users/zefir/',
  'owner__username': 'zefir',
  'parent': null,
  'settings': {
    'sector': {'label': 'Other', 'value': 'Other'},
    'country': [{'label': 'Sweden', 'value': 'SWE'}],
    'description': '',
    'collects_pii': null,
    'organization': '',
    'country_codes': ['SWE'],
    'operational_purpose': null,
  },
  'asset_type': AssetTypeName.survey,
  'files': [],
  'summary': {
    'geo': false,
    'labels': [
      'Your name',
    ],
    'columns': [
      'type',
      'label',
      'required',
    ],
    'lock_all': false,
    'lock_any': false,
    'languages': [],
    'row_count': 1,
    'name_quality': {
      'ok': 1,
      'bad': 0,
      'good': 0,
      'total': 1,
      'firsts': {
        'ok': {
          'name': 'Your_name',
          'index': 1,
          'label': ['Your name'],
        },
      },
    },
    'default_translation': null,
  },
  'date_created': '2024-12-27T13:34:55.637503Z',
  'date_modified': '2024-12-27T13:35:40.543334Z',
  'date_deployed': '2024-12-27T13:35:38.897089Z',
  'version_id': 'veUGfHFYgnfkX9uxo3FoJ6',
  'version__content_hash': '1685a50ec9695c20eafb17a1b5a0e8ce5946e33c',
  'version_count': 2,
  'has_deployment': true,
  'deployed_version_id': 'veUGfHFYgnfkX9uxo3FoJ6',
  'deployed_versions': {
    'count': 1,
    'next': null,
    'previous': null,
    'results': [
      {
        'uid': 'veUGfHFYgnfkX9uxo3FoJ6',
        'url': 'http://kf.kobo.local/api/v2/assets/aBcDe12345/versions/veUGfHFYgnfkX9uxo3FoJ6/',
        'content_hash': '1685a50ec9695c20eafb17a1b5a0e8ce5946e33c',
        'date_deployed': '2024-12-27T13:35:38.894580Z',
        'date_modified': '2024-12-27T13:35:38.894580Z',
      },
    ],
  },
  'deployment__links': {
    'url': 'http://ee.kobo.local/bNOwZTAI',
    'single_url': 'http://ee.kobo.local/single/bNOwZTAI',
    'single_once_url': 'http://ee.kobo.local/single/451523a0f57ad42817198c8b2ae93dc3',
    'offline_url': 'http://ee.kobo.local/x/bNOwZTAI',
    'preview_url': 'http://ee.kobo.local/preview/bNOwZTAI',
    'iframe_url': 'http://ee.kobo.local/i/bNOwZTAI',
    'single_iframe_url': 'http://ee.kobo.local/single/i/bNOwZTAI',
    'single_once_iframe_url': 'http://ee.kobo.local/single/i/451523a0f57ad42817198c8b2ae93dc3',
  },
  'deployment__active': true,
  'deployment__data_download_links': {
    'xls_legacy': 'http://kc.kobo.local/zefir/exports/aBcDe12345/xls/',
    'csv_legacy': 'http://kc.kobo.local/zefir/exports/aBcDe12345/csv/',
    'zip_legacy': 'http://kc.kobo.local/zefir/exports/aBcDe12345/zip/',
    'kml_legacy': 'http://kc.kobo.local/zefir/exports/aBcDe12345/kml/',
    'geojson': 'http://kc.kobo.local/zefir/exports/aBcDe12345/geojson/',
    'spss_labels': 'http://kc.kobo.local/zefir/exports/aBcDe12345/spss/',
    'xls': 'http://kc.kobo.local/zefir/reports/aBcDe12345/export.xlsx',
    'csv': 'http://kc.kobo.local/zefir/reports/aBcDe12345/export.csv',
  },
  'deployment__submission_count': 0,
  'deployment_status': 'deployed',
  'report_styles': {
    'default': {},
    'specified': {
      'end': {},
      'px18z33': {},
    },
    'kuid_names': {
      'end': '4s7wEq869',
      'px18z33': 'px18z33',
    },
  },
  'report_custom': {},
  'advanced_features': {},
  'advanced_submission_schema': {
    'type': 'object',
    '$description': 'no advanced features activated for this form',
  },
  'analysis_form_json': {
    'engines': {},
    'additional_fields': [],
  },
  'map_styles': {},
  'map_custom': {},
  'content': {
    'schema': '1',
    'survey': [
      {
        'name': 'end',
        'type': MetaQuestionTypeName.end,
        '$kuid': '4s7wEq869',
        '$xpath': 'end',
        '$autoname': 'end',
      },
      {
        'type': QuestionTypeName.text,
        '$kuid': 'px18z33',
        'label': ['Your name'],
        '$xpath': 'Your_name',
        'required': false,
        '$autoname': 'Your_name',
      },
    ],
    'settings': {},
    'translated': ['label'],
    'translations': [null],
  },
  'downloads': [
    {'format': 'xls', 'url': 'http://kf.kobo.local/api/v2/assets/aBcDe12345.xls'},
    {'format': 'xml', 'url': 'http://kf.kobo.local/api/v2/assets/aBcDe12345.xml'},
  ],
  'embeds': [
    {'format': 'xls', 'url': 'http://kf.kobo.local/api/v2/assets/aBcDe12345/xls/'},
    {'format': 'xform', 'url': 'http://kf.kobo.local/api/v2/assets/aBcDe12345/xform/'},
  ],
  'xform_link': 'http://kf.kobo.local/api/v2/assets/aBcDe12345/xform/',
  'hooks_link': 'http://kf.kobo.local/api/v2/assets/aBcDe12345/hooks/',
  'tag_string': '',
  'uid': 'aBcDe12345',
  'kind': 'asset',
  'xls_link': 'http://kf.kobo.local/api/v2/assets/aBcDe12345/xls/',
  'name': 'Test form',
  'assignable_permissions': [
    {'url': 'http://kf.kobo.local/api/v2/permissions/view_asset/', 'label': 'View form'},
    {'url': 'http://kf.kobo.local/api/v2/permissions/change_asset/', 'label': 'Edit form'},
    {'url': 'http://kf.kobo.local/api/v2/permissions/manage_asset/', 'label': 'Manage project'},
    {'url': 'http://kf.kobo.local/api/v2/permissions/add_submissions/', 'label': 'Add submissions'},
    {'url': 'http://kf.kobo.local/api/v2/permissions/view_submissions/', 'label': 'View submissions'},
    {
      'url': 'http://kf.kobo.local/api/v2/permissions/partial_submissions/',
      'label': {
        'default': 'Act on submissions only from specific users',
        'view_submissions': 'View submissions only from specific users',
        'change_submissions': 'Edit submissions only from specific users',
        'delete_submissions': 'Delete submissions only from specific users',
        'validate_submissions': 'Validate submissions only from specific users',
      },
    },
    {'url': 'http://kf.kobo.local/api/v2/permissions/change_submissions/', 'label': 'Edit submissions'},
    {'url': 'http://kf.kobo.local/api/v2/permissions/delete_submissions/', 'label': 'Delete submissions'},
    {'url': 'http://kf.kobo.local/api/v2/permissions/validate_submissions/', 'label': 'Validate submissions'},
  ],
  'permissions': [
    {
      'url': 'http://kf.kobo.local/api/v2/assets/aBcDe12345/permission-assignments/pVQvikEvyQYmQazbNxobN6/',
      'user': 'http://kf.kobo.local/api/v2/users/zefir/',
      'permission': 'http://kf.kobo.local/api/v2/permissions/add_submissions/',
      'label': 'Add submissions',
    },
    {
      'url': 'http://kf.kobo.local/api/v2/assets/aBcDe12345/permission-assignments/pFuSpuH2DYWCpqXL6vQ94x/',
      'user': 'http://kf.kobo.local/api/v2/users/zefir/',
      'permission': 'http://kf.kobo.local/api/v2/permissions/change_asset/',
      'label': 'Edit form',
    },
    {
      'url': 'http://kf.kobo.local/api/v2/assets/aBcDe12345/permission-assignments/p48wUoqUifRyj8bJssDKJi/',
      'user': 'http://kf.kobo.local/api/v2/users/zefir/',
      'permission': 'http://kf.kobo.local/api/v2/permissions/change_submissions/',
      'label': 'Edit submissions',
    },
    {
      'url': 'http://kf.kobo.local/api/v2/assets/aBcDe12345/permission-assignments/ptUCvQdK5ghnoHT5WHF8AA/',
      'user': 'http://kf.kobo.local/api/v2/users/zefir/',
      'permission': 'http://kf.kobo.local/api/v2/permissions/delete_submissions/',
      'label': 'Delete submissions',
    },
    {
      'url': 'http://kf.kobo.local/api/v2/assets/aBcDe12345/permission-assignments/pUKmhnLN2UXpxsipebgieS/',
      'user': 'http://kf.kobo.local/api/v2/users/zefir/',
      'permission': 'http://kf.kobo.local/api/v2/permissions/manage_asset/',
      'label': 'Manage project',
    },
    {
      'url': 'http://kf.kobo.local/api/v2/assets/aBcDe12345/permission-assignments/poeQAKvMyjWsQYxejuPKpM/',
      'user': 'http://kf.kobo.local/api/v2/users/zefir/',
      'permission': 'http://kf.kobo.local/api/v2/permissions/validate_submissions/',
      'label': 'Validate submissions',
    },
    {
      'url': 'http://kf.kobo.local/api/v2/assets/aBcDe12345/permission-assignments/pBBjGJRLfMAqdtFvZeNj52/',
      'user': 'http://kf.kobo.local/api/v2/users/zefir/',
      'permission': 'http://kf.kobo.local/api/v2/permissions/view_asset/',
      'label': 'View form',
    },
    {
      'url': 'http://kf.kobo.local/api/v2/assets/aBcDe12345/permission-assignments/p4koRMKP65jdVQuacNPuke/',
      'user': 'http://kf.kobo.local/api/v2/users/zefir/',
      'permission': 'http://kf.kobo.local/api/v2/permissions/view_submissions/',
      'label': 'View submissions',
    },
  ],
  'effective_permissions': [
    {'codename': 'change_asset'},
    {'codename': 'manage_asset'},
    {'codename': 'view_submissions'},
    {'codename': 'validate_submissions'},
    {'codename': 'change_submissions'},
    {'codename': 'delete_asset'},
    {'codename': 'view_asset'},
    {'codename': 'delete_submissions'},
    {'codename': 'add_submissions'},
  ],
  'exports': 'http://kf.kobo.local/api/v2/assets/aBcDe12345/exports/',
  'export_settings': [],
  'data': 'http://kf.kobo.local/api/v2/assets/aBcDe12345/data/',
  'children': {'count': 0},
  'subscribers_count': 0,
  'status': 'private',
  'access_types': null,
  'data_sharing': {},
  'paired_data': 'http://kf.kobo.local/api/v2/assets/aBcDe12345/paired-data/',
  'project_ownership': null,
  'owner_label': 'Test Korp Inc',
} satisfies AssetResponse;

// need an asset with locking profiles included and used for rows

/**
 * A template with few questions, a group and additional Polish labels.
 */
export const simpleTemplate = {...cloneDeep(minimalAssetResponse), ...{
  'asset_type': AssetTypeName.template,
  'name': 'Test template',
  'summary': {
    'geo': false,
    'labels': [
      'Best thing in the world?', 'Person', 'Your name', 'Your age',
    ],
    'columns': [
      'type', 'label', 'required', 'select_from_list_name', 'name',
    ],
    'languages': [
      'English (en)', 'Polski (pl)',
    ],
    'row_count': 4,
    'default_translation': 'English (en)',
  },
  'content': {
    'schema': '1',
    'survey': [
      {
        'name': 'start',
        'type': MetaQuestionTypeName.start,
        '$kuid': 'ZJRmskGCC',
        '$autoname': 'start',
      }, {
        'name': 'end',
        'type': MetaQuestionTypeName.end,
        '$kuid': 'JuoCtJWO5',
        '$autoname': 'end',
      }, {
        'type': QuestionTypeName.select_one,
        '$kuid': 'ri0lk77',
        'label': [
          'Best thing in the world?', 'Najlepsze na świecie?',
        ],
        'required': false,
        '$autoname': 'Best_thing_in_the_world',
        'select_from_list_name': 'dp8iw04',
      }, {
        'name': 'person',
        'type': GroupTypeBeginName.begin_group,
        '$kuid': 'xl7sb31',
        'label': [
          'Person', 'Osoba',
        ],
        '$autoname': 'person',
      }, {
        'type': QuestionTypeName.text,
        '$kuid': 'xw6go48',
        'label': [
          'Your name', 'Twoje imię',
        ],
        'required': false,
        '$autoname': 'Your_name',
      }, {
        'type': QuestionTypeName.integer,
        '$kuid': 'wd3rh84',
        'label': [
          'Your age', 'Twój wiek',
        ],
        'required': false,
        '$autoname': 'Your_age',
      }, {
        'type': GroupTypeEndName.end_group,
        '$kuid': '/xl7sb31',
      },
    ],
    'choices': [
      {
        'name': 'peace',
        '$kuid': '7grWIZ8bE',
        'label': [
          'Peace', 'Pokój',
        ],
        'list_name': 'dp8iw04',
        '$autovalue': 'peace',
      }, {
        'name': 'love',
        '$kuid': 'I4x3DFdQl',
        'label': [
          'Love', 'Miłość',
        ],
        'list_name': 'dp8iw04',
        '$autovalue': 'love',
      }, {
        'name': 'understanding',
        '$kuid': 'klWY60huh',
        'label': [
          'Understanding', 'Zrozumienie',
        ],
        'list_name': 'dp8iw04',
        '$autovalue': 'understanding',
      },
    ],
    'settings': {
      'default_language': 'English (en)',
    },
    'translated': ['label'],
    'translations': ['English (en)', 'Polski (pl)'],
  },
}} satisfies AssetResponse;

/**
 * A template with few questions, a group and additional Polish labels. Some of
 * survey parts have locking profile applied. Whole form also has locking
 * profile applied.
 */
export const simpleTemplateLocked = {...cloneDeep(simpleTemplate), ...{
  'name': 'Test locked template',
  'content': {
    'schema': '1',
    'survey': [
      {
        'name': 'start',
        'type': MetaQuestionTypeName.start,
        '$kuid': 'ZJRmskGCC',
        '$autoname': 'start',
      }, {
        'name': 'end',
        'type': MetaQuestionTypeName.end,
        '$kuid': 'JuoCtJWO5',
        '$autoname': 'end',
      }, {
        'type': QuestionTypeName.select_one,
        '$kuid': 'ri0lk77',
        'label': [
          'Best thing in the world?', 'Najlepsze na świecie?',
        ],
        'required': false,
        '$autoname': 'Best_thing_in_the_world',
        'select_from_list_name': 'dp8iw04',
        'kobo--locking-profile': 'lock2',
      }, {
        'name': 'person',
        'type': GroupTypeBeginName.begin_group,
        '$kuid': 'xl7sb31',
        'label': [
          'Person', 'Osoba',
        ],
        '$autoname': 'person',
        'kobo--locking-profile': 'lock2',
      }, {
        'type': QuestionTypeName.text,
        '$kuid': 'xw6go48',
        'label': [
          'Your name', 'Twoje imię',
        ],
        'required': false,
        '$autoname': 'Your_name',
      }, {
        'type': QuestionTypeName.integer,
        '$kuid': 'wd3rh84',
        'label': [
          'Your age', 'Twój wiek',
        ],
        'required': false,
        '$autoname': 'Your_age',
        'kobo--locking-profile': 'mycustomlock1',
      }, {
        'type': GroupTypeEndName.end_group,
        '$kuid': '/xl7sb31',
      },
    ],
    'choices': [
      {
        'name': 'peace',
        '$kuid': '7grWIZ8bE',
        'label': [
          'Peace', 'Pokój',
        ],
        'list_name': 'dp8iw04',
        '$autovalue': 'peace',
      }, {
        'name': 'love',
        '$kuid': 'I4x3DFdQl',
        'label': [
          'Love', 'Miłość',
        ],
        'list_name': 'dp8iw04',
        '$autovalue': 'love',
      }, {
        'name': 'understanding',
        '$kuid': 'klWY60huh',
        'label': [
          'Understanding', 'Zrozumienie',
        ],
        'list_name': 'dp8iw04',
        '$autovalue': 'understanding',
      },
    ],
    'kobo--locking-profiles': [
      {
        name: 'mycustomlock1',
        restrictions: [
          LockingRestrictionName.choice_add,
          LockingRestrictionName.choice_delete,
          LockingRestrictionName.choice_label_edit,
          LockingRestrictionName.question_settings_edit,
          LockingRestrictionName.group_label_edit,
          LockingRestrictionName.group_question_order_edit,
          LockingRestrictionName.group_add,
          LockingRestrictionName.question_order_edit,
        ],
      },
      {
        name: 'lock2',
        restrictions: [
          LockingRestrictionName.question_delete,
          LockingRestrictionName.group_delete,
          LockingRestrictionName.language_edit,
        ],
      },
    ],
    'settings': {
      'default_language': 'English (en)',
      'kobo--locking-profile': 'mycustomlock1',
    },
    'translated': ['label'],
    'translations': ['English (en)', 'Polski (pl)'],
  },
}} satisfies AssetResponse;

/** A template with some locking profiles on rows, and a lock all property. */
export const simpleTemplateLockedWithAll = merge(
  cloneDeep(simpleTemplateLocked),
  {content: {settings: {[LOCK_ALL_PROP_NAME]: true}}},
);

/** A template with no locking profiles on rows, and a lock all property. */
export const simpleTemplateWithAll = merge(
  cloneDeep(simpleTemplate),
  {content: {settings: {[LOCK_ALL_PROP_NAME]: true}}},
);

/** A template where asset has locking profile but no definition for it. */
export const simpleTemplateLockedFormUndef = merge(
  cloneDeep(simpleTemplateLocked),
  {content: {settings: {[LOCKING_PROFILE_PROP_NAME]: 'nonexistent_lock_1'}}},
);

/**
 * A template with no locking profile definitions, but with asset and row having
 * locking profile assigned.
 */
export const simpleTemplateLockedRowUndef = merge(
  cloneDeep(simpleTemplate),
  {content: {
    settings: {[LOCKING_PROFILE_PROP_NAME]: 'nonexistent_lock_1'},
    survey: [
      {},
      {},
      {[LOCKING_PROFILE_PROP_NAME]: 'nonexistent_lock_2'}],
  }},
);
