import clonedeep from 'lodash.clonedeep'
import { ASSET_TYPES, type AssetTypeName, GroupTypeBeginName, GroupTypeEndName } from '#/constants'
import type { AssetContent } from '#/dataInterface'
import type { KoboMatrixPlainData } from '#/formbuild/containers/KoboMatrix'
import { recordKeys } from '#/utils'
import type { FlatRow, FlatSurvey, Survey } from '../../../xlform/src/model.survey'

/**
 * Asset type could be either the loaded asset type (editing an existing form)
 * or the desired asset type (creating a new form)
 */
export function getFormBuilderAssetType(assetType?: AssetTypeName, desiredAssetType?: AssetTypeName) {
  if (assetType && ASSET_TYPES[assetType]) {
    return ASSET_TYPES[assetType]
  } else if (desiredAssetType && ASSET_TYPES[desiredAssetType]) {
    return ASSET_TYPES[desiredAssetType]
  }
  return null
}

export function surveyToValidJson(survey: Survey) {
  // HACK: This is done as a fix for https://github.com/kobotoolbox/kpi/pull/735
  // I'm not entirely sure what this is about but definitely BAD CODE™!
  //
  // skip logic references only preserved after initial call
  // to "survey.toFlatJSON()"
  survey.toFlatJSON()
  // returning the result of the second call to "toFlatJSON()"
  return JSON.stringify(survey.toFlatJSON())
}

/**
 * This function reverses what `nullifyTranslations` did to the form data.
 */
export function unnullifyTranslations(surveyDataJSON: string, assetContent: AssetContent) {
  // Here we assume that parsed JSON will be `FlatSurvey`. If we ever pass some other string in here, the code would
  // crash. If this ever happens, let's add some checks.
  const surveyData: FlatSurvey = JSON.parse(surveyDataJSON)

  let translatedProps: string[] = []
  if (assetContent.translated) {
    translatedProps = assetContent.translated
  }

  // TRANSLATIONS HACK (Part 2/2):
  // set default_language
  let defaultLang = assetContent.translations_0
  if (!defaultLang) {
    defaultLang = null
  }
  if (!surveyData.settings[0].default_language && defaultLang !== null) {
    surveyData.settings[0].default_language = defaultLang
  }

  if (defaultLang !== null) {
    // replace every "translatedProp" with "translatedProp::defaultLang"
    if (surveyData.choices) {
      surveyData.choices.forEach((choice) => {
        translatedProps.forEach((translatedProp) => {
          if (typeof choice[translatedProp] !== 'undefined') {
            choice[`${translatedProp}::${defaultLang}`] = choice[translatedProp]
            delete choice[translatedProp]
          }
        })
      })
    }
    if (surveyData.survey) {
      surveyData.survey.forEach((surveyRow) => {
        translatedProps.forEach((translatedProp) => {
          if (typeof surveyRow[translatedProp] !== 'undefined') {
            if (
              typeof surveyData.settings[0] !== 'undefined' &&
              typeof surveyData.settings[0].style === 'string' &&
              surveyData.settings[0].style.includes('theme-grid') &&
              surveyRow.type === 'begin_group' &&
              (surveyRow[translatedProp] === null || surveyRow[translatedProp] === '')
            ) {
              delete surveyRow[translatedProp]
            }
            surveyRow[`${translatedProp}::${defaultLang}`] = surveyRow[translatedProp]
            delete surveyRow[translatedProp]
          }
        })
      })
    }
  }

  return JSON.stringify(surveyData)
}

/**
 * @typedef NullifiedTranslations
 * @property {object} survey - Modified survey.
 * @property {Array<string|null>} translations - Modified translations.
 * @property {Array<string|null>} translations_0 - The original default language name.
 */
interface NullifiedTranslations {
  survey: FlatRow[]
  translations: Array<string | null>
  translations_0?: string | null
}

/**
 * A function that adjust the translations data to the Form Builder code.
 * Requires the sibling `unnullifyTranslations` function to be called before
 * saving the form.
 * @param {Array<string|null>} [translations]
 * @param {Array<string>} translatedProps
 * @param {Array<object>} survey
 * @param {object} baseSurvey
 * @return {NullifiedTranslations}
 */
export function nullifyTranslations(
  translations: Array<string | null>,
  translatedProps: string[],
  survey: FlatRow[],
  baseSurvey: FlatSurvey,
): NullifiedTranslations {
  const data: NullifiedTranslations = {
    survey: clonedeep(survey) as FlatRow[],
    translations: clonedeep(translations),
  }

  if (typeof translations === 'undefined') {
    data.translations = [null]
    return data
  }

  if (data.translations.length > 1 && data.translations.indexOf(null) !== -1) {
    throw new Error(
      'There is an unnamed translation in your form definition.\nPlease give a name to all translations in your form.\nUse "Manage Translations" option from form landing page.',
    )
  }

  /*
  TRANSLATIONS HACK (Part 1/2):
  all the coffee code assumes first language to be null, and we don't want
  to introduce potential code-breaking refactor in old code, so we store
  first language, then replace with null and reverse this just before saving
  NOTE: when importing assets from Library into form, we need to make sure
  the default language is the same (or force baseSurvey default language)
  */
  if (baseSurvey) {
    const formDefaultLang = baseSurvey._initialParams.translations_0 || null
    if (data.translations[0] === formDefaultLang) {
      // case 1: nothing to do - same default language in both
    } else if (data.translations.includes(formDefaultLang)) {
      // case 2: imported asset has form default language but not as first, so
      // we need to reorder things
      const defaultLangIndex = data.translations.indexOf(formDefaultLang)

      // Remove default lang, then place it at the beginning
      data.translations.splice(data.translations.indexOf(formDefaultLang), 1)
      data.translations.unshift(formDefaultLang)

      data.survey.forEach((row: FlatRow) => {
        translatedProps.forEach((translatedProp) => {
          const transletedPropArr = row[translatedProp] as string[]
          if (transletedPropArr) {
            // Pick the default lang translation, then place it at the beginning
            const defaultLangTranslation = transletedPropArr.splice(defaultLangIndex, 1)[0]
            transletedPropArr.unshift(defaultLangTranslation)
          }
        })
      })
    }

    if (!data.translations.includes(formDefaultLang)) {
      // case 3: imported asset doesn't have form default language, so we
      // force it onto the asset as the first language and try setting some
      // meaningful property value
      data.translations.unshift(formDefaultLang)
      data.survey.forEach((row: FlatRow) => {
        translatedProps.forEach((translatedProp) => {
          if (row[translatedProp]) {
            let propVal = null
            if (row.name) {
              propVal = row.name
            } else if (row.$autoname) {
              propVal = row.$autoname
            }
            row[translatedProp].unshift(propVal)
          }
        })
      })
    }
  }

  // no need to nullify null
  if (data.translations[0] !== null) {
    data.translations_0 = data.translations[0]
    data.translations[0] = null
  }

  return data
}

export interface KoboMatrixParserParams {
  content?: string
  source?: string
}

export function koboMatrixParser(params: KoboMatrixParserParams): KoboMatrixParserParams {
  let content: Partial<FlatSurvey> = {}
  const rawData = params.content || params.source

  if (!rawData) return params
  try {
    content = JSON.parse(rawData)
  } catch (e) {
    return params
  }

  if (!content.survey) return params

  let hasMatrix = false
  let surveyLength = content.survey.length

  // add open/close tags for kobomatrix groups
  for (var i = 0; i < surveyLength; i++) {
    if (content.survey[i].type === 'kobomatrix') {
      content.survey[i].type = GroupTypeBeginName.begin_kobomatrix
      content.survey[i].appearance = 'field-list'
      surveyLength++
      content.survey.splice(i + 1, 0, { type: GroupTypeEndName.end_kobomatrix, $kuid: `/${content.survey[i].$kuid}` })
    }
  }

  // add columns as items in the group
  for (i = 0; i < surveyLength; i++) {
    if (content.survey[i].type === 'begin_kobomatrix') {
      var j = i
      hasMatrix = true
      var matrix = localStorage.getItem(`koboMatrix.${content.survey[i].$kuid}`)

      if (matrix != null) {
        const matrixData = JSON.parse(matrix) as KoboMatrixPlainData
        for (var kuid of matrixData.cols) {
          i++
          surveyLength++
          content.survey.splice(i, 0, matrixData[kuid])
        }

        for (var k of recordKeys(matrixData.choices)) {
          content.choices?.push(matrixData.choices[k])
        }
      }
      // TODO: handle corrupt matrix data
      // See: https://github.com/kobotoolbox/kpi/issues/3915
    }
  }

  if (hasMatrix) {
    if (params.content) params.content = JSON.stringify(content)
    if (params.source) params.source = JSON.stringify(content)
  }
  return params
}

/**
 * This function (in theory) is reversing what `writeParameters` does.
 *
 * For given semicolon-separated (or comma-separated) string of parameters, it returns an object.
 */
export function readParameters(str: string) {
  if (typeof str !== 'string') {
    return null
  }

  const params: { [key: string]: string } = {}

  let separator = ' '
  if (str.includes(';')) {
    separator = ';'
  } else if (str.includes(',')) {
    separator = ','
  }
  const otherSeparators = ';, '.replace(separator, '')
  const cleanStr = str.replace(/ *= */g, '=')
  const parts = cleanStr.split(new RegExp(`[${otherSeparators}]*${separator}[${otherSeparators}]*`, 'g'))

  parts.forEach((part) => {
    if (part.includes('=')) {
      const key = part.slice(0, part.indexOf('='))
      const value = part.slice(key.length + 1)
      params[key] = value
    }
  })

  if (recordKeys(params).length < 1) {
    return null
  }
  return params
}

/**
 * This function takes an object of some row parameters, and:
 * 1. filters out `undefined` and `null` (values) ones
 * 2. stringifies objects
 * 3. blacklists "seed" for some reason
 * …and finally returns a single string of semicolon-separated parameters.
 */
export function writeParameters(obj: { [key: string]: string }) {
  const params: string[] = []
  recordKeys(obj).forEach((key) => {
    if (obj[key] !== undefined && obj[key] !== null) {
      let value = obj[key]
      if (typeof value === 'object') {
        value = JSON.stringify(value)
      }
      // Preventing addition of `seed=` which blocks project from deploying
      if (!(key === 'seed' && value === '')) {
        params.push(`${key}=${value}`)
      }
    }
  })
  return params.join(';')
}
