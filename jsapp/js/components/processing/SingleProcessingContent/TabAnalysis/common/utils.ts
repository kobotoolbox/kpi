import type { ActionEnum } from '#/api/models/actionEnum'
import type { AdvancedFeatureResponse } from '#/api/models/advancedFeatureResponse'
import type { QualActionParams } from '#/api/models/qualActionParams'
import type { AnalysisQuestionType } from './constants'
import { ANALYSIS_QUESTION_TYPES } from './constants'

export interface AdvancedFeatureResponseManualQual extends AdvancedFeatureResponse {
  action: typeof ActionEnum.manual_qual
  question_xpath: string
  params: QualActionParams[]
  uid: string
}

export function getQuestionTypeDefinition(type: AnalysisQuestionType) {
  return ANALYSIS_QUESTION_TYPES.find((definition) => definition.type === type)
}
