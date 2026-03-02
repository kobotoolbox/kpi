import type { ActionEnum } from '#/api/models/actionEnum'
import type { AdvancedFeatureResponse } from '#/api/models/advancedFeatureResponse'
import type { ResponseManualQualActionParams } from '#/api/models/responseManualQualActionParams'
import { ANALYSIS_QUESTION_TYPES } from './constants'

export interface AdvancedFeatureResponseManualQual extends AdvancedFeatureResponse {
  question_xpath: string
  action: typeof ActionEnum.manual_qual
  params: ResponseManualQualActionParams[]
  uid: string
}

export function getQuestionTypeDefinition(type: ResponseManualQualActionParams['type']) {
  return ANALYSIS_QUESTION_TYPES.find((definition) => definition.type === type)
}
