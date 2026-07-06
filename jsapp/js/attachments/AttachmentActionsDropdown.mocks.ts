import { getApiV2AssetsRetrieveResponseMock } from '#/api/react-query/manage-projects-and-library-content'
import { ANY_ROW_TYPE_NAMES, AssetTypeName } from '#/constants'
import type { AssetResponse, SubmissionResponse } from '#/dataInterface'

export const assetWithImage = getApiV2AssetsRetrieveResponseMock({
  uid: 'aALUCUEKcgKk28owQo3LrA',
  name: 'Small image project',
  owner__username: 'zefir',
  asset_type: AssetTypeName.survey,
  deployment_status: 'deployed',
  has_deployment: true,
  deployment__active: true,
  deployment__submission_count: 1,
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
}) as unknown as AssetResponse

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
      media_file_basename: 'the-origin-of-the-world-12_21_57.jpg',
    },
  ],
  _status: 'submitted_via_web',
  _geolocation: [null, null],
  _submission_time: '2025-03-13T11:21:58',
  _validation_status: {},
  _submitted_by: null,
  _supplementalDetails: {},
}
