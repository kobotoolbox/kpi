import { getApiV2AssetsRetrieveResponseMock } from '#/api/react-query/manage-projects-and-library-content'
import { ANY_ROW_TYPE_NAMES, AssetTypeName } from '#/constants'
import type { AssetResponse } from '#/dataInterface'

export const assetWithBgAudioAndNLP = getApiV2AssetsRetrieveResponseMock({
  uid: 'am5q2MmVckuLBXPKsbHjEt',
  name: 'text and media projekt',
  asset_type: AssetTypeName.survey,
  deployment__active: true,
  deployment__submission_count: 1,
  has_deployment: true,
  summary: {
    geo: false,
    labels: ['Your name here', 'Your selfie goes here', 'A video? WTF', 'Secret password as an audio file'],
    columns: ['name', 'type', 'label', 'required', 'parameters'],
    lock_all: false,
    lock_any: false,
    languages: [],
    row_count: 5,
    name_quality: { ok: 0, bad: 0, good: 5, total: 5, firsts: {} },
    default_translation: null,
  },
  advanced_features: {
    qual: {
      qual_survey: [
        {
          type: 'qualSelectOne',
          uuid: 'e59a3552-c06c-43f2-92f1-8e3607052624',
          scope: 'by_question#survey',
          xpath: 'background-audio',
          labels: {
            _default: 'Is this bg audio?',
          },
          choices: [
            {
              uuid: '9064acd3-dd10-46ff-a0f8-0861b5e35fcb',
              labels: {
                _default: 'yes',
              },
            },
            {
              uuid: 'b431159b-4de1-4656-91d2-763f27dc4388',
              labels: {
                _default: 'nej',
              },
            },
          ],
        },
      ],
    },
    transcript: {
      languages: ['en'],
    },
    translation: {
      languages: ['fr'],
    },
  },
  analysis_form_json: {
    additional_fields: [
      {
        dtpath: 'background-audio/transcript_en',
        type: 'transcript',
        language: 'en',
        label: 'background-audio - transcript',
        name: 'background-audio/transcript_en',
        source: 'background-audio',
      },
      {
        dtpath: 'background-audio/translation_fr',
        type: 'translation',
        language: 'fr',
        label: 'background-audio - translation',
        name: 'background-audio/translation_fr',
        source: 'background-audio',
      },
      {
        label: 'Is this bg audio?',
        name: 'background-audio/e59a3552-c06c-43f2-92f1-8e3607052624',
        dtpath: 'background-audio/e59a3552-c06c-43f2-92f1-8e3607052624',
        type: 'qualSelectOne',
        language: '??',
        source: 'background-audio',
        choices: [
          {
            uuid: '9064acd3-dd10-46ff-a0f8-0861b5e35fcb',
            labels: {
              _default: 'yes',
            },
          },
          {
            uuid: 'b431159b-4de1-4656-91d2-763f27dc4388',
            labels: {
              _default: 'nej',
            },
          },
        ],
      },
    ],
  },
  content: {
    schema: '1',
    survey: [
      {
        name: 'start',
        type: ANY_ROW_TYPE_NAMES.start,
        $kuid: 'M3AXQZPzW',
        $xpath: 'start',
        $autoname: 'start',
      },
      {
        name: 'end',
        type: ANY_ROW_TYPE_NAMES.end,
        $kuid: 'MlyFnjOHJ',
        $xpath: 'end',
        $autoname: 'end',
      },
      {
        name: 'today',
        type: ANY_ROW_TYPE_NAMES.today,
        $kuid: 'aBemgUnm5',
        $xpath: 'today',
        $autoname: 'today',
      },
      {
        name: 'username',
        type: ANY_ROW_TYPE_NAMES.username,
        $kuid: 'mQjEGodmD',
        $xpath: 'username',
        $autoname: 'username',
      },
      {
        name: 'deviceid',
        type: ANY_ROW_TYPE_NAMES.deviceid,
        $kuid: 'SzW7bWk8N',
        $xpath: 'deviceid',
        $autoname: 'deviceid',
      },
      {
        name: 'phonenumber',
        type: ANY_ROW_TYPE_NAMES.phonenumber,
        $kuid: 'UfrYC0nkS',
        $xpath: 'phonenumber',
        $autoname: 'phonenumber',
      },
      {
        name: 'audit',
        type: ANY_ROW_TYPE_NAMES.audit,
        $kuid: 'QG4SJ5LYb',
        $xpath: 'audit',
        $autoname: 'audit',
      },
      {
        name: 'Your_name_here',
        type: ANY_ROW_TYPE_NAMES.text,
        $kuid: '25l27nQ3a',
        label: ['Your name here'],
        $xpath: 'Your_name_here',
        required: false,
        $autoname: 'Your_name_here',
      },
      {
        name: 'Your_selfie_goes_here',
        type: ANY_ROW_TYPE_NAMES.image,
        $kuid: 'd0JxfaSC9',
        label: ['Your selfie goes here'],
        $xpath: 'Your_selfie_goes_here',
        required: false,
        $autoname: 'Your_selfie_goes_here',
      },
      {
        name: 'A_video_WTF',
        type: ANY_ROW_TYPE_NAMES.video,
        $kuid: 'alGpvxEVv',
        label: ['A video? WTF'],
        $xpath: 'A_video_WTF',
        required: false,
        $autoname: 'A_video_WTF',
      },
      {
        name: 'Secret_password_as_an_audio_file',
        type: ANY_ROW_TYPE_NAMES.audio,
        $kuid: '2sN8g5yJ2',
        label: ['Secret password as an audio file'],
        $xpath: 'Secret_password_as_an_audio_file',
        required: false,
        $autoname: 'Secret_password_as_an_audio_file',
      },
      {
        name: 'background-audio',
        type: ANY_ROW_TYPE_NAMES['background-audio'],
        $kuid: 'dE9sDyVtS',
        $xpath: 'background-audio',
        $autoname: 'background-audio',
        parameters: 'quality=voice-only',
      },
    ],
    settings: {
      version: '3 (2021-12-28 13:33:41)',
      id_string: 'text_and_media_project',
    },
    translated: ['label'],
    translations: [null],
  },
  effective_permissions: [{ codename: 'change_submissions' }],
}) as unknown as AssetResponse

export const assetWithNestedGroupsAndNLP = getApiV2AssetsRetrieveResponseMock({
  uid: 'aRai4qmXVG4eukrzpHXAQC',
  name: 'Project with audio inside nested group',
  asset_type: AssetTypeName.survey,
  deployment__active: true,
  deployment__submission_count: 1,
  has_deployment: true,
  summary: {
    geo: false,
    labels: ['What did you hear?'],
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
          name: 'What_did_you_hear',
          index: 1,
          label: ['What did you hear?'],
        },
      },
    },
    default_translation: null,
  },
  advanced_features: {
    transcript: {
      languages: ['pl'],
    },
    translation: {
      languages: ['de'],
    },
  },
  analysis_form_json: {
    additional_fields: [
      {
        dtpath: 'outer_group/middle_group/inner_group/What_did_you_hear/transcript_pl',
        type: 'transcript',
        language: 'pl',
        label: 'What_did_you_hear - transcript',
        name: 'outer_group/middle_group/inner_group/What_did_you_hear/transcript_pl',
        source: 'outer_group/middle_group/inner_group/What_did_you_hear',
      },
      {
        dtpath: 'outer_group/middle_group/inner_group/What_did_you_hear/translation_de',
        type: 'translation',
        language: 'de',
        label: 'What_did_you_hear - translation',
        name: 'outer_group/middle_group/inner_group/What_did_you_hear/translation_de',
        source: 'outer_group/middle_group/inner_group/What_did_you_hear',
      },
    ],
  },
  content: {
    schema: '1',
    survey: [
      {
        name: 'outer_group',
        type: ANY_ROW_TYPE_NAMES.begin_group,
        $kuid: 'kx8rw55',
        label: ['Outer group'],
        $xpath: 'outer_group',
        $autoname: 'outer_group',
      },
      {
        name: 'middle_group',
        type: ANY_ROW_TYPE_NAMES.begin_group,
        $kuid: 'py8fl89',
        label: ['Middle group'],
        $xpath: 'outer_group/middle_group',
        $autoname: 'middle_group',
      },
      {
        name: 'inner_group',
        type: ANY_ROW_TYPE_NAMES.begin_group,
        $kuid: 'oh5pd61',
        label: ['Inner group'],
        $xpath: 'outer_group/middle_group/inner_group',
        $autoname: 'inner_group',
      },
      {
        type: ANY_ROW_TYPE_NAMES.audio,
        $kuid: 'sm28q44',
        label: ['What did you hear?'],
        $xpath: 'outer_group/middle_group/inner_group/What_did_you_hear',
        required: false,
        $autoname: 'What_did_you_hear',
      },
      {
        type: ANY_ROW_TYPE_NAMES.end_group,
        $kuid: '/oh5pd61',
      },
      {
        type: ANY_ROW_TYPE_NAMES.end_group,
        $kuid: '/py8fl89',
      },
      {
        type: ANY_ROW_TYPE_NAMES.end_group,
        $kuid: '/kx8rw55',
      },
    ],
    settings: {},
    translated: ['label'],
    translations: [null],
  },
  effective_permissions: [{ codename: 'change_submissions' }],
}) as unknown as AssetResponse
