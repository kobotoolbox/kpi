import type {AssetResponse} from 'js/dataInterface';
import {ANY_ROW_TYPE_NAMES, AssetTypeName} from 'js/constants';

export const assetWithBgAudioAndNLP: AssetResponse = {
  'url': 'http://kf.kobo.local/api/v2/assets/am5q2MmVckuLBXPKsbHjEt',
  'owner': 'http://kf.kobo.local/api/v2/users/kobo.json',
  'owner__username': 'kobo',
  'owner_label': 'kobo',
  'parent': null,
  'settings': {
    'sector': {},
    'country': [],
    'description': '',
    'organization': '',
    'country_codes': [],
  },
  'asset_type': AssetTypeName.survey,
  'files': [],
  'summary': {
    'geo': false,
    'labels': [
      'Your name here',
      'Your selfie goes here',
      'A video? WTF',
      'Secret password as an audio file',
    ],
    'columns': [
      'name',
      'type',
      'label',
      'required',
      'parameters',
    ],
    'lock_all': false,
    'lock_any': false,
    'languages': [],
    'row_count': 5,
    'name_quality': {
      'ok': 0,
      'bad': 0,
      'good': 5,
      'total': 5,
      'firsts': {},
    },
    'default_translation': null,
  },
  'date_created': '2024-10-21T10:20:46.811112Z',
  'date_modified': '2024-10-23T13:54:50.828315Z',
  'date_deployed': '2024-10-21T10:21:16.157454Z',
  'version_id': 'vM3yepjgRLxbQfTy4V7JQ9',
  'version__content_hash': '8362f2d2c4100490fae4f811bad5296188421855',
  'version_count': 6,
  'has_deployment': true,
  'deployed_version_id': 'vsuXfYXtZpRaXdWcDQe8cS',
  'deployed_versions': {
    'count': 1,
    'next': null,
    'previous': null,
    'results': [
      {
        'uid': 'vsuXfYXtZpRaXdWcDQe8cS',
        'url': 'http://kf.kobo.local/api/v2/assets/am5q2MmVckuLBXPKsbHjEt/versions/vsuXfYXtZpRaXdWcDQe8cS/',
        'content_hash': '8362f2d2c4100490fae4f811bad5296188421855',
        'date_deployed': '2024-10-21T10:21:16.154074Z',
        'date_modified': '2024-10-21T10:21:16.154074Z',
      },
    ],
  },
  'deployment__links': {
    'url': 'http://ee.kobo.local/YnqSWtB3',
    'single_url': 'http://ee.kobo.local/single/YnqSWtB3',
    'single_once_url': 'http://ee.kobo.local/single/9778636aa5d24eb2f0806bab320e7bc6',
    'offline_url': 'http://ee.kobo.local/x/YnqSWtB3',
    'preview_url': 'http://ee.kobo.local/preview/YnqSWtB3',
    'iframe_url': 'http://ee.kobo.local/i/YnqSWtB3',
    'single_iframe_url': 'http://ee.kobo.local/single/i/YnqSWtB3',
    'single_once_iframe_url': 'http://ee.kobo.local/single/i/9778636aa5d24eb2f0806bab320e7bc6',
  },
  'deployment__active': true,
  'deployment__data_download_links': {
    'xls_legacy': 'http://kc.kobo.local/kobo/exports/am5q2MmVckuLBXPKsbHjEt/xls/',
    'csv_legacy': 'http://kc.kobo.local/kobo/exports/am5q2MmVckuLBXPKsbHjEt/csv/',
    'zip_legacy': 'http://kc.kobo.local/kobo/exports/am5q2MmVckuLBXPKsbHjEt/zip/',
    'kml_legacy': 'http://kc.kobo.local/kobo/exports/am5q2MmVckuLBXPKsbHjEt/kml/',
    'geojson': 'http://kc.kobo.local/kobo/exports/am5q2MmVckuLBXPKsbHjEt/geojson/',
    'spss_labels': 'http://kc.kobo.local/kobo/exports/am5q2MmVckuLBXPKsbHjEt/spss/',
    'xls': 'http://kc.kobo.local/kobo/reports/am5q2MmVckuLBXPKsbHjEt/export.xlsx',
    'csv': 'http://kc.kobo.local/kobo/reports/am5q2MmVckuLBXPKsbHjEt/export.csv',
  },
  'deployment__submission_count': 1,
  'deployment_status': 'deployed',
  'report_styles': {
    'default': {},
    'specified': {
      'end': {},
      'audit': {},
      'start': {},
      'today': {},
      'deviceid': {},
      'username': {},
      'simserial': {},
      'A_video_WTF': {},
      'phonenumber': {},
      'subscriberid': {},
      'Your_name_here': {},
      'background-audio': {},
      'Your_selfie_goes_here': {},
      'Secret_password_as_an_audio_file': {},
    },
    'kuid_names': {
      'end': 'MlyFnjOHJ',
      'audit': 'QG4SJ5LYb',
      'start': 'M3AXQZPzW',
      'today': 'aBemgUnm5',
      'deviceid': 'SzW7bWk8N',
      'username': 'mQjEGodmD',
      'simserial': 'QsCIjT134',
      'A_video_WTF': 'alGpvxEVv',
      'phonenumber': 'UfrYC0nkS',
      'subscriberid': '6iTYT9Hk1',
      'Your_name_here': '25l27nQ3a',
      'background-audio': 'dE9sDyVtS',
      'Your_selfie_goes_here': 'd0JxfaSC9',
      'Secret_password_as_an_audio_file': '2sN8g5yJ2',
    },
  },
  'report_custom': {},
  'advanced_features': {
    'qual': {
      'qual_survey': [
        {
          'type': 'qual_select_one',
          'uuid': 'e59a3552-c06c-43f2-92f1-8e3607052624',
          'scope': 'by_question#survey',
          'xpath': 'background-audio',
          'labels': {
            '_default': 'Is this bg audio?',
          },
          'choices': [
            {
              'uuid': '9064acd3-dd10-46ff-a0f8-0861b5e35fcb',
              'labels': {
                '_default': 'yes',
              },
            },
            {
              'uuid': 'b431159b-4de1-4656-91d2-763f27dc4388',
              'labels': {
                '_default': 'nej',
              },
            },
          ],
        },
      ],
    },
    'transcript': {
      'languages': [
        'en',
      ],
    },
    'translation': {
      'languages': [
        'fr',
      ],
    },
  },
  'advanced_submission_schema': {
    'type': 'object',
    '$description': 'PATCH or POST a matching JSON structure to a submission and it will be stored and processed accordingly.',
    'url': 'http://kf.kobo.local/advanced_submission_post/am5q2MmVckuLBXPKsbHjEt',
    'properties': {
      'submission': {
        'type': 'string',
        'description': 'the uuid of the submission',
      },
      'background-audio': {
        'type': 'object',
        'additionalProperties': false,
        'properties': {
          'qual': {
            'type': 'array',
            'items': {
              '$ref': '#/definitions/qual_item',
            },
          },
          'transcript': {
            '$ref': '#/definitions/transcript',
          },
          'googlets': {
            '$ref': '#/definitions/_googlets',
          },
          'translation': {
            '$ref': '#/definitions/translation',
          },
          'googletx': {
            '$ref': '#/definitions/_googletx',
          },
        },
      },
      'A_video_WTF': {
        'type': 'object',
        'properties': {
          'transcript': {
            '$ref': '#/definitions/transcript',
          },
          'googlets': {
            '$ref': '#/definitions/_googlets',
          },
          'translation': {
            '$ref': '#/definitions/translation',
          },
          'googletx': {
            '$ref': '#/definitions/_googletx',
          },
        },
        'additionalProperties': false,
      },
      'Secret_password_as_an_audio_file': {
        'type': 'object',
        'properties': {
          'transcript': {
            '$ref': '#/definitions/transcript',
          },
          'googlets': {
            '$ref': '#/definitions/_googlets',
          },
          'translation': {
            '$ref': '#/definitions/translation',
          },
          'googletx': {
            '$ref': '#/definitions/_googletx',
          },
        },
        'additionalProperties': false,
      },
      'Your_name_here': {
        'type': 'object',
        'properties': {
          'translation': {
            '$ref': '#/definitions/translation',
          },
          'googletx': {
            '$ref': '#/definitions/_googletx',
          },
        },
        'additionalProperties': false,
      },
    },
    'additionalProperties': false,
    'required': [
      'submission',
    ],
    'definitions': {
      'qual_base': {
        'type': 'object',
        'additionalProperties': false,
        'properties': {
          'uuid': {
            'type': 'string',
          },
          'type': {
            'type': 'string',
          },
          'val': {},
        },
        'required': [
          'uuid',
          'type',
          'val',
        ],
      },
      'qual_tags': {
        'type': 'object',
        'properties': {
          'val': {
            'type': 'array',
            'items': {
              'type': 'string',
            },
          },
          'type': {
            'const': 'qual_tags',
          },
        },
      },
      'qual_text': {
        'type': 'object',
        'properties': {
          'type': {
            'const': 'qual_text',
          },
          'val': {
            'type': 'string',
          },
        },
      },
      'qual_integer': {
        'type': 'object',
        'properties': {
          'type': {
            'const': 'qual_integer',
          },
          'val': {
            'type': [
              'integer',
              'null',
            ],
          },
        },
      },
      'qual_select_one': {
        'type': 'object',
        'properties': {
          'type': {
            'const': 'qual_select_one',
          },
          'val': {
            'type': 'string',
            'minLength': 1,
          },
        },
      },
      'qual_select_multiple': {
        'type': 'object',
        'properties': {
          'type': {
            'const': 'qual_select_multiple',
          },
          'val': {
            'type': 'array',
            'items': {
              'type': 'string',
              'minLength': 1,
            },
          },
        },
      },
      'qual_item': {
        'anyOf': [
          {
            '$ref': '#/definitions/qual_tags',
          },
          {
            '$ref': '#/definitions/qual_text',
          },
          {
            '$ref': '#/definitions/qual_integer',
          },
          {
            '$ref': '#/definitions/qual_select_one',
          },
          {
            '$ref': '#/definitions/qual_select_multiple',
          },
        ],
        'allOf': [
          {
            '$ref': '#/definitions/qual_base',
          },
        ],
      },
      'transcript': {
        'type': 'object',
        'properties': {
          'value': {
            'type': 'string',
          },
          'engine': {
            'type': 'string',
          },
          'dateCreated': {
            'type': 'string',
            'format': 'date-time',
          },
          'dateModified': {
            'type': 'string',
            'format': 'date-time',
          },
          'languageCode': {
            'type': 'string',
          },
          'regionCode': {
            'type': 'string',
          },
          'revisions': {
            'type': 'array',
            'items': {
              '$ref': '#/definitions/transcriptRevision',
            },
          },
        },
        'additionalProperties': false,
        'required': [
          'value',
        ],
      },
      'transcriptRevision': {
        'type': 'object',
        'properties': {
          'value': {
            'type': 'string',
          },
          'engine': {
            'type': 'string',
          },
          'dateModified': {
            'type': 'string',
            'format': 'date-time',
          },
          'languageCode': {
            'type': 'string',
          },
        },
        'additionalProperties': false,
        'required': [
          'value',
        ],
      },
      '_googlets': {
        'type': 'object',
        'properties': {
          'status': {
            'enum': [
              'requested',
              'in_progress',
              'complete',
              'error',
            ],
          },
          'responseJSON': {
            'type': 'object',
            'properties': {
              'error': {
                'type': 'string',
              },
              'detail': {
                'type': 'string',
              },
            },
          },
        },
      },
      '_googletx': {
        'type': 'object',
        'properties': {
          'status': {
            'enum': [
              'requested',
              'in_progress',
              'complete',
              'error',
            ],
          },
          'responseJSON': {
            'type': 'object',
            'properties': {
              'error': {
                'type': 'string',
              },
              'detail': {
                'type': 'string',
              },
            },
          },
        },
      },
      'xtranslation': {
        'type': 'object',
        'additionalProperties': false,
        'required': [
          'value',
          'languageCode',
        ],
        'properties': {
          'value': {
            'type': 'string',
          },
          'engine': {
            'type': 'string',
          },
          'dateCreated': {
            'type': 'string',
            'format': 'date-time',
          },
          'dateModified': {
            'type': 'string',
            'format': 'date-time',
          },
          'languageCode': {
            'type': 'string',
          },
          'revisions': {
            'type': 'array',
            'items': {
              '$ref': '#/definitions/translationRevision',
            },
          },
        },
      },
      'translation': {
        'type': 'object',
        'properties': {
          'fr': {
            '$ref': '#/definitions/xtranslation',
          },
        },
        'additionalProperties': false,
      },
      'translationRevision': {
        'type': 'object',
        'properties': {
          'value': {
            'type': 'string',
          },
          'engine': {
            'type': 'string',
          },
          'dateModified': {
            'type': 'string',
            'format': 'date-time',
          },
          'languageCode': {
            'type': 'string',
          },
        },
        'additionalProperties': false,
        'required': [
          'value',
        ],
      },
    },
  },
  'analysis_form_json': {
    'engines': {
      'engines/transcript_manual': {
        'details': 'A human provided transcription',
      },
      'engines/translation': {
        'details': 'A human provided translation',
      },
    },
    'additional_fields': [
      {
        'dtpath': 'background-audio/transcript_en',
        'type': 'transcript',
        'language': 'en',
        'label': 'background-audio - transcript',
        'name': 'background-audio/transcript_en',
        'source': 'background-audio',
        'xpath': 'background-audio/transcript/en',
        'settings': {
          'mode': 'manual',
          'engine': 'engines/transcript_manual',
        },
        'path': [
          'background-audio',
          'transcript',
        ],
      },
      {
        'dtpath': 'background-audio/translation_fr',
        'type': 'translation',
        'language': 'fr',
        'label': 'background-audio - translation',
        'name': 'background-audio/translation_fr',
        'source': 'background-audio',
        'xpath': 'background-audio/translation/fr',
        'settings': {
          'mode': 'manual',
          'engine': 'engines/translation_manual',
        },
        'path': [
          'background-audio',
          'translation',
        ],
      },
      {
        'label': 'Is this bg audio?',
        'name': 'background-audio/e59a3552-c06c-43f2-92f1-8e3607052624',
        'dtpath': 'background-audio/e59a3552-c06c-43f2-92f1-8e3607052624',
        'type': 'qual_select_one',
        'language': '??',
        'source': 'background-audio',
        'xpath': 'background-audio/e59a3552-c06c-43f2-92f1-8e3607052624',
        'settings': '??',
        'path': [
          'background-audio',
          'e59a3552-c06c-43f2-92f1-8e3607052624',
        ],
        'choices': [
          {
            'uuid': '9064acd3-dd10-46ff-a0f8-0861b5e35fcb',
            'labels': {
              '_default': 'yes',
            },
          },
          {
            'uuid': 'b431159b-4de1-4656-91d2-763f27dc4388',
            'labels': {
              '_default': 'nej',
            },
          },
        ],
      },
    ],
  },
  'map_styles': {},
  'map_custom': {},
  'content': {
    'schema': '1',
    'survey': [
      {
        'name': 'start',
        'type': ANY_ROW_TYPE_NAMES.start,
        '$kuid': 'M3AXQZPzW',
        '$xpath': 'start',
        '$autoname': 'start',
      },
      {
        'name': 'end',
        'type': ANY_ROW_TYPE_NAMES.end,
        '$kuid': 'MlyFnjOHJ',
        '$xpath': 'end',
        '$autoname': 'end',
      },
      {
        'name': 'today',
        'type': ANY_ROW_TYPE_NAMES.today,
        '$kuid': 'aBemgUnm5',
        '$xpath': 'today',
        '$autoname': 'today',
      },
      {
        'name': 'username',
        'type': ANY_ROW_TYPE_NAMES.username,
        '$kuid': 'mQjEGodmD',
        '$xpath': 'username',
        '$autoname': 'username',
      },
      {
        'name': 'deviceid',
        'type': ANY_ROW_TYPE_NAMES.deviceid,
        '$kuid': 'SzW7bWk8N',
        '$xpath': 'deviceid',
        '$autoname': 'deviceid',
      },
      {
        'name': 'phonenumber',
        'type': ANY_ROW_TYPE_NAMES.phonenumber,
        '$kuid': 'UfrYC0nkS',
        '$xpath': 'phonenumber',
        '$autoname': 'phonenumber',
      },
      {
        'name': 'audit',
        'type': ANY_ROW_TYPE_NAMES.audit,
        '$kuid': 'QG4SJ5LYb',
        '$xpath': 'audit',
        '$autoname': 'audit',
      },
      {
        'name': 'Your_name_here',
        'type': ANY_ROW_TYPE_NAMES.text,
        '$kuid': '25l27nQ3a',
        'label': [
          'Your name here',
        ],
        '$xpath': 'Your_name_here',
        'required': false,
        '$autoname': 'Your_name_here',
      },
      {
        'name': 'Your_selfie_goes_here',
        'type': ANY_ROW_TYPE_NAMES.image,
        '$kuid': 'd0JxfaSC9',
        'label': [
          'Your selfie goes here',
        ],
        '$xpath': 'Your_selfie_goes_here',
        'required': false,
        '$autoname': 'Your_selfie_goes_here',
      },
      {
        'name': 'A_video_WTF',
        'type': ANY_ROW_TYPE_NAMES.video,
        '$kuid': 'alGpvxEVv',
        'label': [
          'A video? WTF',
        ],
        '$xpath': 'A_video_WTF',
        'required': false,
        '$autoname': 'A_video_WTF',
      },
      {
        'name': 'Secret_password_as_an_audio_file',
        'type': ANY_ROW_TYPE_NAMES.audio,
        '$kuid': '2sN8g5yJ2',
        'label': [
          'Secret password as an audio file',
        ],
        '$xpath': 'Secret_password_as_an_audio_file',
        'required': false,
        '$autoname': 'Secret_password_as_an_audio_file',
      },
      {
        'name': 'background-audio',
        'type': ANY_ROW_TYPE_NAMES['background-audio'],
        '$kuid': 'dE9sDyVtS',
        '$xpath': 'background-audio',
        '$autoname': 'background-audio',
        'parameters': 'quality=voice-only',
      },
    ],
    'settings': {
      'version': '3 (2021-12-28 13:33:41)',
      'id_string': 'text_and_media_project',
    },
    'translated': [
      'label',
    ],
    'translations': [
      null,
    ],
  },
  'downloads': [
    {
      'format': 'xls',
      'url': 'http://kf.kobo.local/api/v2/assets/am5q2MmVckuLBXPKsbHjEt.xls',
    },
    {
      'format': 'xml',
      'url': 'http://kf.kobo.local/api/v2/assets/am5q2MmVckuLBXPKsbHjEt.xml',
    },
  ],
  'embeds': [
    {
      'format': 'xls',
      'url': 'http://kf.kobo.local/api/v2/assets/am5q2MmVckuLBXPKsbHjEt/xls/',
    },
    {
      'format': 'xform',
      'url': 'http://kf.kobo.local/api/v2/assets/am5q2MmVckuLBXPKsbHjEt/xform/',
    },
  ],
  'xform_link': 'http://kf.kobo.local/api/v2/assets/am5q2MmVckuLBXPKsbHjEt/xform/',
  'hooks_link': 'http://kf.kobo.local/api/v2/assets/am5q2MmVckuLBXPKsbHjEt/hooks/',
  'tag_string': '',
  'uid': 'am5q2MmVckuLBXPKsbHjEt',
  'kind': 'asset',
  'xls_link': 'http://kf.kobo.local/api/v2/assets/am5q2MmVckuLBXPKsbHjEt/xls/',
  'name': 'text and media projekt',
  'assignable_permissions': [
    {
      'url': 'http://kf.kobo.local/api/v2/permissions/view_asset/',
      'label': 'View form',
    },
    {
      'url': 'http://kf.kobo.local/api/v2/permissions/change_asset/',
      'label': 'Edit form',
    },
    {
      'url': 'http://kf.kobo.local/api/v2/permissions/manage_asset/',
      'label': 'Manage project',
    },
    {
      'url': 'http://kf.kobo.local/api/v2/permissions/add_submissions/',
      'label': 'Add submissions',
    },
    {
      'url': 'http://kf.kobo.local/api/v2/permissions/view_submissions/',
      'label': 'View submissions',
    },
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
    {
      'url': 'http://kf.kobo.local/api/v2/permissions/change_submissions/',
      'label': 'Edit submissions',
    },
    {
      'url': 'http://kf.kobo.local/api/v2/permissions/delete_submissions/',
      'label': 'Delete submissions',
    },
    {
      'url': 'http://kf.kobo.local/api/v2/permissions/validate_submissions/',
      'label': 'Validate submissions',
    },
  ],
  'permissions': [
    {
      'url': 'http://kf.kobo.local/api/v2/assets/am5q2MmVckuLBXPKsbHjEt/permission-assignments/pUmPzC6pFgDdcB2cxLn9QD/',
      'user': 'http://kf.kobo.local/api/v2/users/AnonymousUser.json',
      'permission': 'http://kf.kobo.local/api/v2/permissions/add_submissions.json',
      'label': 'Add submissions',
    },
    {
      'url': 'http://kf.kobo.local/api/v2/assets/am5q2MmVckuLBXPKsbHjEt/permission-assignments/p6nyXrHUs5BpNJLZPaunvJ/',
      'user': 'http://kf.kobo.local/api/v2/users/kobo.json',
      'permission': 'http://kf.kobo.local/api/v2/permissions/add_submissions.json',
      'label': 'Add submissions',
    },
    {
      'url': 'http://kf.kobo.local/api/v2/assets/am5q2MmVckuLBXPKsbHjEt/permission-assignments/pz7RvRMsYHuJL9TRyQyoDP/',
      'user': 'http://kf.kobo.local/api/v2/users/kobo.json',
      'permission': 'http://kf.kobo.local/api/v2/permissions/change_asset.json',
      'label': 'Edit form',
    },
    {
      'url': 'http://kf.kobo.local/api/v2/assets/am5q2MmVckuLBXPKsbHjEt/permission-assignments/pM7p797FK3qQjCYADpxojX/',
      'user': 'http://kf.kobo.local/api/v2/users/kobo.json',
      'permission': 'http://kf.kobo.local/api/v2/permissions/change_submissions.json',
      'label': 'Edit submissions',
    },
    {
      'url': 'http://kf.kobo.local/api/v2/assets/am5q2MmVckuLBXPKsbHjEt/permission-assignments/p8aL4ifctta3AxvRWeUwsz/',
      'user': 'http://kf.kobo.local/api/v2/users/kobo.json',
      'permission': 'http://kf.kobo.local/api/v2/permissions/delete_submissions.json',
      'label': 'Delete submissions',
    },
    {
      'url': 'http://kf.kobo.local/api/v2/assets/am5q2MmVckuLBXPKsbHjEt/permission-assignments/paBd2H3gyWhZQBkGzGvfjE/',
      'user': 'http://kf.kobo.local/api/v2/users/kobo.json',
      'permission': 'http://kf.kobo.local/api/v2/permissions/manage_asset.json',
      'label': 'Manage project',
    },
    {
      'url': 'http://kf.kobo.local/api/v2/assets/am5q2MmVckuLBXPKsbHjEt/permission-assignments/pAdfYDhVHTWXNMv8CTZxFz/',
      'user': 'http://kf.kobo.local/api/v2/users/kobo.json',
      'permission': 'http://kf.kobo.local/api/v2/permissions/validate_submissions.json',
      'label': 'Validate submissions',
    },
    {
      'url': 'http://kf.kobo.local/api/v2/assets/am5q2MmVckuLBXPKsbHjEt/permission-assignments/p782nm85UEcMy56EvxiNMz/',
      'user': 'http://kf.kobo.local/api/v2/users/kobo.json',
      'permission': 'http://kf.kobo.local/api/v2/permissions/view_asset.json',
      'label': 'View form',
    },
    {
      'url': 'http://kf.kobo.local/api/v2/assets/am5q2MmVckuLBXPKsbHjEt/permission-assignments/pPAFrcPkXTuQFWywccDzr7/',
      'user': 'http://kf.kobo.local/api/v2/users/kobo.json',
      'permission': 'http://kf.kobo.local/api/v2/permissions/view_submissions.json',
      'label': 'View submissions',
    },
  ],
  'effective_permissions': [
    {
      'codename': 'delete_submissions',
    },
    {
      'codename': 'view_asset',
    },
    {
      'codename': 'change_asset',
    },
    {
      'codename': 'view_submissions',
    },
    {
      'codename': 'delete_asset',
    },
    {
      'codename': 'manage_asset',
    },
    {
      'codename': 'change_submissions',
    },
    {
      'codename': 'validate_submissions',
    },
    {
      'codename': 'add_submissions',
    },
  ],
  'exports': 'http://kf.kobo.local/api/v2/assets/am5q2MmVckuLBXPKsbHjEt/exports/',
  'export_settings': [],
  'data': 'http://kf.kobo.local/api/v2/assets/am5q2MmVckuLBXPKsbHjEt/data.json',
  'children': {
    'count': 0,
  },
  'subscribers_count': 0,
  'status': 'shared',
  'access_types': null,
  'data_sharing': {},
  'paired_data': 'http://kf.kobo.local/api/v2/assets/am5q2MmVckuLBXPKsbHjEt/paired-data/',
  'project_ownership': null,
};

export const assetWithNestedGroupsAndNLP: AssetResponse = {
  'url': 'http://kf.kobo.local/api/v2/assets/aRai4qmXVG4eukrzpHXAQC.json',
  'owner': 'http://kf.kobo.local/api/v2/users/kobo.json',
  'owner__username': 'kobo',
  'owner_label': 'kobo',
  'parent': null,
  'settings': {
    'sector': {},
    'country': [],
    'description': '',
    'collects_pii': null,
    'organization': '',
    'country_codes': [],
    'operational_purpose': null,
  },
  'asset_type': AssetTypeName.survey,
  'files': [],
  'summary': {
    'geo': false,
    'labels': [
      'What did you hear?',
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
          'name': 'What_did_you_hear',
          'index': 1,
          'label': [
            'What did you hear?',
          ],
        },
      },
    },
    'default_translation': null,
  },
  'date_created': '2024-10-24T21:50:14.547659Z',
  'date_modified': '2024-10-24T22:10:01.271453Z',
  'date_deployed': '2024-10-24T21:52:53.487365Z',
  'version_id': 'veWGMzgZCdiNnDvBdxtrQj',
  'version__content_hash': '778df104b69459fe67b8431bb500433b82e2ee33',
  'version_count': 7,
  'has_deployment': true,
  'deployed_version_id': 'v4MNF9dNVo682gg2KZc5P7',
  'deployed_versions': {
    'count': 1,
    'next': null,
    'previous': null,
    'results': [
      {
        'uid': 'v4MNF9dNVo682gg2KZc5P7',
        'url': 'http://kf.kobo.local/api/v2/assets/aRai4qmXVG4eukrzpHXAQC/versions/v4MNF9dNVo682gg2KZc5P7/',
        'content_hash': '778df104b69459fe67b8431bb500433b82e2ee33',
        'date_deployed': '2024-10-24T21:52:53.478265Z',
        'date_modified': '2024-10-24T21:52:53.478265Z',
      },
    ],
  },
  'deployment__links': {
    'url': 'http://ee.kobo.local/iQdYiTID',
    'single_url': 'http://ee.kobo.local/single/iQdYiTID',
    'single_once_url': 'http://ee.kobo.local/single/7edea25f7e36766e7558a8a9d2e015f0',
    'offline_url': 'http://ee.kobo.local/x/iQdYiTID',
    'preview_url': 'http://ee.kobo.local/preview/iQdYiTID',
    'iframe_url': 'http://ee.kobo.local/i/iQdYiTID',
    'single_iframe_url': 'http://ee.kobo.local/single/i/iQdYiTID',
    'single_once_iframe_url': 'http://ee.kobo.local/single/i/7edea25f7e36766e7558a8a9d2e015f0',
  },
  'deployment__active': true,
  'deployment__data_download_links': {
    'xls_legacy': 'http://kc.kobo.local/kobo/exports/aRai4qmXVG4eukrzpHXAQC/xls/',
    'csv_legacy': 'http://kc.kobo.local/kobo/exports/aRai4qmXVG4eukrzpHXAQC/csv/',
    'zip_legacy': 'http://kc.kobo.local/kobo/exports/aRai4qmXVG4eukrzpHXAQC/zip/',
    'kml_legacy': 'http://kc.kobo.local/kobo/exports/aRai4qmXVG4eukrzpHXAQC/kml/',
    'geojson': 'http://kc.kobo.local/kobo/exports/aRai4qmXVG4eukrzpHXAQC/geojson/',
    'spss_labels': 'http://kc.kobo.local/kobo/exports/aRai4qmXVG4eukrzpHXAQC/spss/',
    'xls': 'http://kc.kobo.local/kobo/reports/aRai4qmXVG4eukrzpHXAQC/export.xlsx',
    'csv': 'http://kc.kobo.local/kobo/reports/aRai4qmXVG4eukrzpHXAQC/export.csv',
  },
  'deployment__submission_count': 1,
  'deployment_status': 'deployed',
  'report_styles': {
    'default': {},
    'specified': {
      'end': {},
      'start': {},
      'sm28q44': {},
      '/kx8rw55': {},
      '/oh5pd61': {},
      '/py8fl89': {},
      'inner_group': {},
      'outer_group': {},
      'middle_group': {},
    },
    'kuid_names': {
      'end': 'wnxtTQ2B1',
      'start': 'D8zvSJsd3',
      'sm28q44': 'sm28q44',
      '/kx8rw55': '/kx8rw55',
      '/oh5pd61': '/oh5pd61',
      '/py8fl89': '/py8fl89',
      'inner_group': 'oh5pd61',
      'outer_group': 'kx8rw55',
      'middle_group': 'py8fl89',
    },
  },
  'report_custom': {},
  'advanced_features': {
    'transcript': {
      'languages': [
        'pl',
      ],
    },
    'translation': {
      'languages': [
        'de',
      ],
    },
  },
  'advanced_submission_schema': {
    'type': 'object',
    '$description': 'PATCH or POST a matching JSON structure to a submission and it will be stored and processed accordingly.',
    'url': 'http://kf.kobo.local/advanced_submission_post/aRai4qmXVG4eukrzpHXAQC',
    'properties': {
      'submission': {
        'type': 'string',
        'description': 'the uuid of the submission',
      },
      'outer_group/middle_group/inner_group/What_did_you_hear': {
        'type': 'object',
        'properties': {
          'transcript': {
            '$ref': '#/definitions/transcript',
          },
          'googlets': {
            '$ref': '#/definitions/_googlets',
          },
          'translation': {
            '$ref': '#/definitions/translation',
          },
          'googletx': {
            '$ref': '#/definitions/_googletx',
          },
        },
        'additionalProperties': false,
      },
    },
    'additionalProperties': false,
    'required': [
      'submission',
    ],
    'definitions': {
      'transcript': {
        'type': 'object',
        'properties': {
          'value': {
            'type': 'string',
          },
          'engine': {
            'type': 'string',
          },
          'dateCreated': {
            'type': 'string',
            'format': 'date-time',
          },
          'dateModified': {
            'type': 'string',
            'format': 'date-time',
          },
          'languageCode': {
            'type': 'string',
          },
          'regionCode': {
            'type': 'string',
          },
          'revisions': {
            'type': 'array',
            'items': {
              '$ref': '#/definitions/transcriptRevision',
            },
          },
        },
        'additionalProperties': false,
        'required': [
          'value',
        ],
      },
      'transcriptRevision': {
        'type': 'object',
        'properties': {
          'value': {
            'type': 'string',
          },
          'engine': {
            'type': 'string',
          },
          'dateModified': {
            'type': 'string',
            'format': 'date-time',
          },
          'languageCode': {
            'type': 'string',
          },
        },
        'additionalProperties': false,
        'required': [
          'value',
        ],
      },
      '_googlets': {
        'type': 'object',
        'properties': {
          'status': {
            'enum': [
              'requested',
              'in_progress',
              'complete',
              'error',
            ],
          },
          'responseJSON': {
            'type': 'object',
            'properties': {
              'error': {
                'type': 'string',
              },
              'detail': {
                'type': 'string',
              },
            },
          },
        },
      },
      '_googletx': {
        'type': 'object',
        'properties': {
          'status': {
            'enum': [
              'requested',
              'in_progress',
              'complete',
              'error',
            ],
          },
          'responseJSON': {
            'type': 'object',
            'properties': {
              'error': {
                'type': 'string',
              },
              'detail': {
                'type': 'string',
              },
            },
          },
        },
      },
      'xtranslation': {
        'type': 'object',
        'additionalProperties': false,
        'required': [
          'value',
          'languageCode',
        ],
        'properties': {
          'value': {
            'type': 'string',
          },
          'engine': {
            'type': 'string',
          },
          'dateCreated': {
            'type': 'string',
            'format': 'date-time',
          },
          'dateModified': {
            'type': 'string',
            'format': 'date-time',
          },
          'languageCode': {
            'type': 'string',
          },
          'revisions': {
            'type': 'array',
            'items': {
              '$ref': '#/definitions/translationRevision',
            },
          },
        },
      },
      'translation': {
        'type': 'object',
        'properties': {
          'de': {
            '$ref': '#/definitions/xtranslation',
          },
        },
        'additionalProperties': false,
      },
      'translationRevision': {
        'type': 'object',
        'properties': {
          'value': {
            'type': 'string',
          },
          'engine': {
            'type': 'string',
          },
          'dateModified': {
            'type': 'string',
            'format': 'date-time',
          },
          'languageCode': {
            'type': 'string',
          },
        },
        'additionalProperties': false,
        'required': [
          'value',
        ],
      },
    },
  },
  'analysis_form_json': {
    'engines': {
      'engines/transcript_manual': {
        'details': 'A human provided transcription',
      },
      'engines/translation': {
        'details': 'A human provided translation',
      },
    },
    'additional_fields': [
      {
        'dtpath': 'outer_group/middle_group/inner_group/What_did_you_hear/transcript_pl',
        'type': 'transcript',
        'language': 'pl',
        'label': 'What_did_you_hear - transcript',
        'name': 'outer_group/middle_group/inner_group/What_did_you_hear/transcript_pl',
        'source': 'outer_group/middle_group/inner_group/What_did_you_hear',
        'xpath': 'outer_group/middle_group/inner_group/What_did_you_hear/transcript/pl',
        'settings': {
          'mode': 'manual',
          'engine': 'engines/transcript_manual',
        },
        'path': [
          'outer_group/middle_group/inner_group/What_did_you_hear',
          'transcript',
        ],
      },
      {
        'dtpath': 'outer_group/middle_group/inner_group/What_did_you_hear/translation_de',
        'type': 'translation',
        'language': 'de',
        'label': 'What_did_you_hear - translation',
        'name': 'outer_group/middle_group/inner_group/What_did_you_hear/translation_de',
        'source': 'outer_group/middle_group/inner_group/What_did_you_hear',
        'xpath': 'outer_group/middle_group/inner_group/What_did_you_hear/translation/de',
        'settings': {
          'mode': 'manual',
          'engine': 'engines/translation_manual',
        },
        'path': [
          'outer_group/middle_group/inner_group/What_did_you_hear',
          'translation',
        ],
      },
    ],
  },
  'map_styles': {},
  'map_custom': {},
  'content': {
    'schema': '1',
    'survey': [
      {
        'name': 'outer_group',
        'type': ANY_ROW_TYPE_NAMES.begin_group,
        '$kuid': 'kx8rw55',
        'label': [
          'Outer group',
        ],
        '$xpath': 'outer_group',
        '$autoname': 'outer_group',
      },
      {
        'name': 'middle_group',
        'type': ANY_ROW_TYPE_NAMES.begin_group,
        '$kuid': 'py8fl89',
        'label': [
          'Middle group',
        ],
        '$xpath': 'outer_group/middle_group',
        '$autoname': 'middle_group',
      },
      {
        'name': 'inner_group',
        'type': ANY_ROW_TYPE_NAMES.begin_group,
        '$kuid': 'oh5pd61',
        'label': [
          'Inner group',
        ],
        '$xpath': 'outer_group/middle_group/inner_group',
        '$autoname': 'inner_group',
      },
      {
        'type': ANY_ROW_TYPE_NAMES.audio,
        '$kuid': 'sm28q44',
        'label': [
          'What did you hear?',
        ],
        '$xpath': 'outer_group/middle_group/inner_group/What_did_you_hear',
        'required': false,
        '$autoname': 'What_did_you_hear',
      },
      {
        'type': ANY_ROW_TYPE_NAMES.end_group,
        '$kuid': '/oh5pd61',
      },
      {
        'type': ANY_ROW_TYPE_NAMES.end_group,
        '$kuid': '/py8fl89',
      },
      {
        'type': ANY_ROW_TYPE_NAMES.end_group,
        '$kuid': '/kx8rw55',
      },
    ],
    'settings': {},
    'translated': [
      'label',
    ],
    'translations': [
      null,
    ],
  },
  'downloads': [
    {
      'format': 'xls',
      'url': 'http://kf.kobo.local/api/v2/assets/aRai4qmXVG4eukrzpHXAQC.xls',
    },
    {
      'format': 'xml',
      'url': 'http://kf.kobo.local/api/v2/assets/aRai4qmXVG4eukrzpHXAQC.xml',
    },
  ],
  'embeds': [
    {
      'format': 'xls',
      'url': 'http://kf.kobo.local/api/v2/assets/aRai4qmXVG4eukrzpHXAQC/xls/',
    },
    {
      'format': 'xform',
      'url': 'http://kf.kobo.local/api/v2/assets/aRai4qmXVG4eukrzpHXAQC/xform/',
    },
  ],
  'xform_link': 'http://kf.kobo.local/api/v2/assets/aRai4qmXVG4eukrzpHXAQC/xform/',
  'hooks_link': 'http://kf.kobo.local/api/v2/assets/aRai4qmXVG4eukrzpHXAQC/hooks/',
  'tag_string': '',
  'uid': 'aRai4qmXVG4eukrzpHXAQC',
  'kind': 'asset',
  'xls_link': 'http://kf.kobo.local/api/v2/assets/aRai4qmXVG4eukrzpHXAQC/xls/',
  'name': 'Project with audio inside nested group',
  'assignable_permissions': [
    {
      'url': 'http://kf.kobo.local/api/v2/permissions/view_asset/',
      'label': 'View form',
    },
    {
      'url': 'http://kf.kobo.local/api/v2/permissions/change_asset/',
      'label': 'Edit form',
    },
    {
      'url': 'http://kf.kobo.local/api/v2/permissions/manage_asset/',
      'label': 'Manage project',
    },
    {
      'url': 'http://kf.kobo.local/api/v2/permissions/add_submissions/',
      'label': 'Add submissions',
    },
    {
      'url': 'http://kf.kobo.local/api/v2/permissions/view_submissions/',
      'label': 'View submissions',
    },
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
    {
      'url': 'http://kf.kobo.local/api/v2/permissions/change_submissions/',
      'label': 'Edit submissions',
    },
    {
      'url': 'http://kf.kobo.local/api/v2/permissions/delete_submissions/',
      'label': 'Delete submissions',
    },
    {
      'url': 'http://kf.kobo.local/api/v2/permissions/validate_submissions/',
      'label': 'Validate submissions',
    },
  ],
  'permissions': [
    {
      'url': 'http://kf.kobo.local/api/v2/assets/aRai4qmXVG4eukrzpHXAQC/permission-assignments/pCYMKNGknBkN5vMpsFeBrL/',
      'user': 'http://kf.kobo.local/api/v2/users/kobo.json',
      'permission': 'http://kf.kobo.local/api/v2/permissions/add_submissions.json',
      'label': 'Add submissions',
    },
    {
      'url': 'http://kf.kobo.local/api/v2/assets/aRai4qmXVG4eukrzpHXAQC/permission-assignments/pWH6k8kQyjT4z3WAheWhTH/',
      'user': 'http://kf.kobo.local/api/v2/users/kobo.json',
      'permission': 'http://kf.kobo.local/api/v2/permissions/change_asset.json',
      'label': 'Edit form',
    },
    {
      'url': 'http://kf.kobo.local/api/v2/assets/aRai4qmXVG4eukrzpHXAQC/permission-assignments/pF4feraPmjmGwbs4XGGjMd/',
      'user': 'http://kf.kobo.local/api/v2/users/kobo.json',
      'permission': 'http://kf.kobo.local/api/v2/permissions/change_submissions.json',
      'label': 'Edit submissions',
    },
    {
      'url': 'http://kf.kobo.local/api/v2/assets/aRai4qmXVG4eukrzpHXAQC/permission-assignments/pWXMaN6dAiwWv9kE5s2Mvn/',
      'user': 'http://kf.kobo.local/api/v2/users/kobo.json',
      'permission': 'http://kf.kobo.local/api/v2/permissions/delete_submissions.json',
      'label': 'Delete submissions',
    },
    {
      'url': 'http://kf.kobo.local/api/v2/assets/aRai4qmXVG4eukrzpHXAQC/permission-assignments/peFnddaDPNehS3H95ZuVEe/',
      'user': 'http://kf.kobo.local/api/v2/users/kobo.json',
      'permission': 'http://kf.kobo.local/api/v2/permissions/manage_asset.json',
      'label': 'Manage project',
    },
    {
      'url': 'http://kf.kobo.local/api/v2/assets/aRai4qmXVG4eukrzpHXAQC/permission-assignments/pAqCW3fjVQLQNtBX4rxZjg/',
      'user': 'http://kf.kobo.local/api/v2/users/kobo.json',
      'permission': 'http://kf.kobo.local/api/v2/permissions/validate_submissions.json',
      'label': 'Validate submissions',
    },
    {
      'url': 'http://kf.kobo.local/api/v2/assets/aRai4qmXVG4eukrzpHXAQC/permission-assignments/puB4cwPhyJFprC5zXcdD8K/',
      'user': 'http://kf.kobo.local/api/v2/users/kobo.json',
      'permission': 'http://kf.kobo.local/api/v2/permissions/view_asset.json',
      'label': 'View form',
    },
    {
      'url': 'http://kf.kobo.local/api/v2/assets/aRai4qmXVG4eukrzpHXAQC/permission-assignments/poNyR5qmXJ7Wjq99qMuncR/',
      'user': 'http://kf.kobo.local/api/v2/users/kobo.json',
      'permission': 'http://kf.kobo.local/api/v2/permissions/view_submissions.json',
      'label': 'View submissions',
    },
  ],
  'effective_permissions': [
    {
      'codename': 'view_submissions',
    },
    {
      'codename': 'validate_submissions',
    },
    {
      'codename': 'add_submissions',
    },
    {
      'codename': 'manage_asset',
    },
    {
      'codename': 'delete_submissions',
    },
    {
      'codename': 'delete_asset',
    },
    {
      'codename': 'view_asset',
    },
    {
      'codename': 'change_asset',
    },
    {
      'codename': 'change_submissions',
    },
  ],
  'exports': 'http://kf.kobo.local/api/v2/assets/aRai4qmXVG4eukrzpHXAQC/exports/',
  'export_settings': [],
  'data': 'http://kf.kobo.local/api/v2/assets/aRai4qmXVG4eukrzpHXAQC/data.json',
  'children': {
    'count': 0,
  },
  'subscribers_count': 0,
  'status': 'private',
  'access_types': null,
  'data_sharing': {},
  'paired_data': 'http://kf.kobo.local/api/v2/assets/aRai4qmXVG4eukrzpHXAQC/paired-data/',
  'project_ownership': null,
};
