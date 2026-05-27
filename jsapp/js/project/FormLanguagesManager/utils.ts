import cloneDeep from 'lodash.clonedeep'
import { LockingRestrictionName } from '#/components/locking/lockingConstants'
import { hasRowRestriction } from '#/components/locking/lockingUtils'
import { GROUP_TYPES_BEGIN, QUESTION_TYPES } from '#/constants'
import type { AssetContent, AssetResponse, SureveyRowOrChoiceTranslatableProp, SurveyRow } from '#/dataInterface'
import { recordKeys } from '#/utils'
import type { TranslationRowItem } from './types'

export const SAVE_BUTTON_LABEL = {
  idle: t('Save Changes'),
  dirty: t('* Save Changes'),
  saving: t('Saving…'),
} as const

export function prepareTranslations(contentOriginal: AssetContent) {
  const content = cloneDeep(contentOriginal)

  if (!content.translated || !content.translations) {
    return content
  }

  if (content.survey) {
    for (let i = 0, len = content.survey.length; i < len; i++) {
      const row = content.survey[i]
      for (let j = 0, len2 = content.translated.length; j < len2; j++) {
        const propertyName = content.translated[j]
        const rowProperty = row[propertyName as keyof SurveyRow]
        if (Array.isArray(rowProperty) && rowProperty.length < content.translations.length) {
          ;(rowProperty as SureveyRowOrChoiceTranslatableProp).push(null)
        }
      }
    }
  }

  if (content.choices?.length) {
    for (let i = 0, len = content.choices.length; i < len; i++) {
      const choice = content.choices[i]
      if (Array.isArray(choice.label) && choice.label.length < content.translations.length) {
        choice.label.push(null)
      }
    }
  }

  return content
}

export function deleteTranslations(contentOriginal: AssetContent, langIndex: number) {
  const content = cloneDeep(contentOriginal)

  if (!content?.translated || !content.translations) {
    return content
  }

  if (content.survey) {
    for (let i = 0, len = content.survey.length; i < len; i++) {
      const row = content.survey[i]
      for (let j = 0, len2 = content.translated.length; j < len2; j++) {
        const propertyName = content.translated[j]
        const rowProperty = row[propertyName as keyof SurveyRow]
        if (Array.isArray(rowProperty)) {
          if (rowProperty.length === content.translations.length) {
            rowProperty.splice(langIndex, 1)
          } else {
            return false
          }
        }
      }
    }
  }

  if (content.choices?.length) {
    for (let i = 0, len = content.choices.length; i < len; i++) {
      const choice = content.choices[i]
      if (choice.label) {
        if (choice.label.length === content.translations.length) {
          choice.label.splice(langIndex, 1)
        } else {
          return false
        }
      }
    }
  }

  return content
}

export function buildTranslationRows(asset: AssetResponse, langIndex: number): TranslationRowItem[] {
  const rows: TranslationRowItem[] = []
  const content = asset.content

  if (!content?.survey || !content?.translated) {
    return rows
  }

  const translatedProps = content.translated
  const lockedChoiceLists: string[] = []

  content.survey.forEach((row) => {
    const rowName = row.name || row.$autoname
    const labelLocked =
      row?.label && rowName
        ? row.type === GROUP_TYPES_BEGIN.begin_group
          ? hasRowRestriction(content, rowName, LockingRestrictionName.group_label_edit)
          : recordKeys(QUESTION_TYPES).includes(row.type as never)
            ? hasRowRestriction(content, rowName, LockingRestrictionName.question_label_edit)
            : false
        : false

    if (
      rowName &&
      hasRowRestriction(content, rowName, LockingRestrictionName.choice_label_edit) &&
      row.select_from_list_name
    ) {
      lockedChoiceLists.push(row.select_from_list_name)
    }

    translatedProps.forEach((property) => {
      const rowValue = row[property as keyof SurveyRow]
      if (Array.isArray(rowValue) && rowValue[0]) {
        rows.push({
          original: String(rowValue[0]),
          value: (rowValue[langIndex] as string | null) ?? null,
          name: rowName || '',
          itemProp: property,
          contentProp: 'survey',
          isLabelLocked: labelLocked,
        })
      }
    })
  })

  if (content.choices?.length) {
    content.choices.forEach((choice) => {
      if (choice.label && choice.label[0]) {
        rows.push({
          original: String(choice.label[0]),
          value: (choice.label[langIndex] as string | null) ?? null,
          name: choice.name || choice.$autovalue || '',
          listName: choice.list_name,
          itemProp: 'label',
          contentProp: 'choices',
          isLabelLocked: lockedChoiceLists.includes(choice.list_name),
        })
      }
    })
  }

  return rows
}
