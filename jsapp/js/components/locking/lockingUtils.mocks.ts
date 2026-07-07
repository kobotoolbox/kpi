import cloneDeep from 'lodash.clonedeep'
import merge from 'lodash.merge'
import { getApiV2AssetsRetrieveResponseMock } from '#/api/react-query/manage-projects-and-library-content.msw'
import {
  AssetTypeName,
  GroupTypeBeginName,
  GroupTypeEndName,
  MetaQuestionTypeName,
  QuestionTypeName,
} from '#/constants'
import type { AssetResponse } from '#/dataInterface'
import { LOCKING_PROFILE_PROP_NAME, LOCK_ALL_PROP_NAME, LockingRestrictionName } from './lockingConstants'

/**
 * This is a minimal response from asset endpoint. Uses Orval-generated factory
 * for type safety and to ensure all required fields are present.
 */
const minimalAssetResponse = getApiV2AssetsRetrieveResponseMock({
  uid: 'aBcDe12345',
  name: 'Test form',
  owner__username: 'zefir',
  asset_type: AssetTypeName.survey,
  deployment_status: 'deployed',
  has_deployment: true,
  deployment__active: true,
  deployment__submission_count: 0,
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
      firsts: {
        ok: {
          name: 'Your_name',
          index: 1,
          label: ['Your name'],
        },
      },
    },
    default_translation: null,
  },
  content: {
    schema: '1',
    survey: [
      {
        name: 'end',
        type: MetaQuestionTypeName.end,
        $kuid: '4s7wEq869',
        $xpath: 'end',
        $autoname: 'end',
      },
      {
        type: QuestionTypeName.text,
        $kuid: 'px18z33',
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
}) as unknown as AssetResponse

// need an asset with locking profiles included and used for rows

/**
 * A template with few questions, a group and additional Polish labels.
 */
export const simpleTemplate = {
  ...cloneDeep(minimalAssetResponse),
  asset_type: AssetTypeName.template,
  name: 'Test template',
  summary: {
    geo: false,
    labels: ['Best thing in the world?', 'Person', 'Your name', 'Your age'],
    columns: ['type', 'label', 'required', 'select_from_list_name', 'name'],
    languages: ['English (en)', 'Polski (pl)'],
    row_count: 4,
    default_translation: 'English (en)',
    lock_all: false,
    lock_any: false,
    name_quality: {
      ok: 4,
      bad: 0,
      good: 0,
      total: 4,
      firsts: {},
    },
  },
  content: {
    schema: '1',
    survey: [
      {
        name: 'start',
        type: MetaQuestionTypeName.start,
        $kuid: 'ZJRmskGCC',
        $autoname: 'start',
      },
      {
        name: 'end',
        type: MetaQuestionTypeName.end,
        $kuid: 'JuoCtJWO5',
        $autoname: 'end',
      },
      {
        type: QuestionTypeName.select_one,
        $kuid: 'ri0lk77',
        label: ['Best thing in the world?', 'Najlepsze na świecie?'],
        required: false,
        $autoname: 'Best_thing_in_the_world',
        select_from_list_name: 'dp8iw04',
      },
      {
        name: 'person',
        type: GroupTypeBeginName.begin_group,
        $kuid: 'xl7sb31',
        label: ['Person', 'Osoba'],
        $autoname: 'person',
      },
      {
        type: QuestionTypeName.text,
        $kuid: 'xw6go48',
        label: ['Your name', 'Twoje imię'],
        required: false,
        $autoname: 'Your_name',
      },
      {
        type: QuestionTypeName.integer,
        $kuid: 'wd3rh84',
        label: ['Your age', 'Twój wiek'],
        required: false,
        $autoname: 'Your_age',
      },
      {
        type: GroupTypeEndName.end_group,
        $kuid: '/xl7sb31',
      },
    ],
    choices: [
      {
        name: 'peace',
        $kuid: '7grWIZ8bE',
        label: ['Peace', 'Pokój'],
        list_name: 'dp8iw04',
        $autovalue: 'peace',
      },
      {
        name: 'love',
        $kuid: 'I4x3DFdQl',
        label: ['Love', 'Miłość'],
        list_name: 'dp8iw04',
        $autovalue: 'love',
      },
      {
        name: 'understanding',
        $kuid: 'klWY60huh',
        label: ['Understanding', 'Zrozumienie'],
        list_name: 'dp8iw04',
        $autovalue: 'understanding',
      },
    ],
    settings: {
      default_language: 'English (en)',
    },
    translated: ['label'],
    translations: ['English (en)', 'Polski (pl)'],
  },
}

/**
 * A template with few questions, a group and additional Polish labels. Some of
 * survey parts have locking profile applied. Whole form also has locking
 * profile applied.
 */
export const simpleTemplateLocked = {
  ...cloneDeep(simpleTemplate),
  name: 'Test locked template',
  content: {
    schema: '1',
    survey: [
      {
        name: 'start',
        type: MetaQuestionTypeName.start,
        $kuid: 'ZJRmskGCC',
        $autoname: 'start',
      },
      {
        name: 'end',
        type: MetaQuestionTypeName.end,
        $kuid: 'JuoCtJWO5',
        $autoname: 'end',
      },
      {
        type: QuestionTypeName.select_one,
        $kuid: 'ri0lk77',
        label: ['Best thing in the world?', 'Najlepsze na świecie?'],
        required: false,
        $autoname: 'Best_thing_in_the_world',
        select_from_list_name: 'dp8iw04',
        'kobo--locking-profile': 'lock2',
      },
      {
        name: 'person',
        type: GroupTypeBeginName.begin_group,
        $kuid: 'xl7sb31',
        label: ['Person', 'Osoba'],
        $autoname: 'person',
        'kobo--locking-profile': 'lock2',
      },
      {
        type: QuestionTypeName.text,
        $kuid: 'xw6go48',
        label: ['Your name', 'Twoje imię'],
        required: false,
        $autoname: 'Your_name',
      },
      {
        type: QuestionTypeName.integer,
        $kuid: 'wd3rh84',
        label: ['Your age', 'Twój wiek'],
        required: false,
        $autoname: 'Your_age',
        'kobo--locking-profile': 'mycustomlock1',
      },
      {
        type: GroupTypeEndName.end_group,
        $kuid: '/xl7sb31',
      },
    ],
    choices: [
      {
        name: 'peace',
        $kuid: '7grWIZ8bE',
        label: ['Peace', 'Pokój'],
        list_name: 'dp8iw04',
        $autovalue: 'peace',
      },
      {
        name: 'love',
        $kuid: 'I4x3DFdQl',
        label: ['Love', 'Miłość'],
        list_name: 'dp8iw04',
        $autovalue: 'love',
      },
      {
        name: 'understanding',
        $kuid: 'klWY60huh',
        label: ['Understanding', 'Zrozumienie'],
        list_name: 'dp8iw04',
        $autovalue: 'understanding',
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
    settings: {
      default_language: 'English (en)',
      'kobo--locking-profile': 'mycustomlock1',
    },
    translated: ['label'],
    translations: ['English (en)', 'Polski (pl)'],
  },
}

/** A template with some locking profiles on rows, and a lock all property. */
export const simpleTemplateLockedWithAll = merge(cloneDeep(simpleTemplateLocked), {
  content: { settings: { [LOCK_ALL_PROP_NAME]: true } },
})

/** A template with no locking profiles on rows, and a lock all property. */
export const simpleTemplateWithAll = merge(cloneDeep(simpleTemplate), {
  content: { settings: { [LOCK_ALL_PROP_NAME]: true } },
})

/** A template where asset has locking profile but no definition for it. */
export const simpleTemplateLockedFormUndef = merge(cloneDeep(simpleTemplateLocked), {
  content: { settings: { [LOCKING_PROFILE_PROP_NAME]: 'nonexistent_lock_1' } },
})

/**
 * A template with no locking profile definitions, but with asset and row having
 * locking profile assigned.
 */
export const simpleTemplateLockedRowUndef = merge(cloneDeep(simpleTemplate), {
  content: {
    settings: { [LOCKING_PROFILE_PROP_NAME]: 'nonexistent_lock_1' },
    survey: [{}, {}, { [LOCKING_PROFILE_PROP_NAME]: 'nonexistent_lock_2' }],
  },
})
