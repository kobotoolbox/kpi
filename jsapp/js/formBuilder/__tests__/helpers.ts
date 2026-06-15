import clonedeep from 'lodash.clonedeep'
import dkobo_xlform from '../../../xlform/src/_xlform.init'
import { surveyToValidJson, unnullifyTranslations } from '#/components/formBuilder/formBuilderUtils'
import type { AssetContent } from '#/dataInterface'

export function createSurvey() {
  return dkobo_xlform.model.Survey.create()
}

export function loadSurvey(content: AssetContent) {
  return dkobo_xlform.model.Survey.loadDict(clonedeep(content))
}

export function serialize(survey: any): Record<string, any> {
  let json = surveyToValidJson(survey)
  if (survey._initialParams?.translations_0) {
    json = unnullifyTranslations(json, survey._initialParams)
  }
  return JSON.parse(json)
}

export function addRow(survey: any, attrs: Record<string, any>) {
  survey.addRow(attrs)
  return survey.rows.last()
}

export function surveyRow(survey: any, type: string) {
  return serialize(survey).survey.find((r: any) => r.type === type)
}

// Find a row in the live survey model by its $autoname (as loaded from a fixture)
export function findRowByAutoname(survey: any, autoname: string): any {
  let found: any = null
  survey.forEachRow((row: any) => {
    const detail = row.get?.('$autoname')
    if (detail?.get?.('value') === autoname) found = row
  }, { includeGroups: true })
  return found
}

// Set a label on a live row
export function setLabel(row: any, value: string) {
  row.get('label').set('value', value)
}
