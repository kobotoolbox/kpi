import * as Sentry from '@sentry/react'
import clonedeep from 'lodash.clonedeep'
import { fetchPatch, fetchPostUrl, handleApiFail } from '#/api'
import { endpoints } from '#/api.endpoints'
import { ActionEnum } from '#/api/models/actionEnum'
import type { AdvancedFeatureResponse } from '#/api/models/advancedFeatureResponse'
import type { DataSupplementResponse } from '#/api/models/dataSupplementResponse'
import type { QualActionParams } from '#/api/models/qualActionParams'
import { buildSubmissionSupplementUrl, getAssetAdvancedFeatures } from '#/assetUtils'
import type { Json } from '#/components/common/common.interfaces'
import type { FailResponse } from '#/dataInterface'
import { notify, recordEntries } from '#/utils'
import { NO_FEATURE_ERROR } from '../../../processingActions'
import type { AnalysisQuestionsAction } from './analysisQuestions.actions'
import type { AnalysisQuestionsState } from './analysisQuestions.reducer'
import type {
  AnalysisQuestionInternal,
  AnalysisQuestionSchema,
  AnalysisQuestionType,
  AnalysisResponseUpdateRequest,
} from './constants'
import { ANALYSIS_QUESTION_TYPES } from './constants'

export interface AdvancedFeatureResponseManualQual extends AdvancedFeatureResponse {
  action: typeof ActionEnum.manual_qual
  question_xpath: string
  params: QualActionParams[]
  uid: string
}

/** Finds given question in state */
export function findQuestion(uuid: string, state: AnalysisQuestionsState) {
  return state.questions.find((question) => question.uuid === uuid)
}

export function getQuestionTypeDefinition(type: AnalysisQuestionType) {
  return ANALYSIS_QUESTION_TYPES.find((definition) => definition.type === type)
}

/**
 * Builds schema definitions from question definitions. Useful for updating
 * questions definitions on endpoint.
 */
function convertQuestionsFromInternalToSchema(questions: AnalysisQuestionInternal[]): AnalysisQuestionSchema[] {
  return questions.map((question) => {
    return {
      uuid: question.uuid,
      type: question.type,
      labels: question.labels,
      options: question.options,
      choices: question.additionalFields?.choices,
      scope: 'by_question#survey',
      xpath: question.xpath,
    }
  })
}

/**
 * Build question definitions from schema definitions. Useful for initializing
 * the analysis questions UI after loading existing question definitions from
 * schema.
 */
export function convertQuestionsFromSchemaToInternal(
  af?: AdvancedFeatureResponseManualQual,
): AnalysisQuestionInternal[] {
  return (
    af?.params.map((_question) => {
      const question = _question as QualActionParams
      const output: AnalysisQuestionInternal = {
        xpath: af.question_xpath,
        uuid: af.uid, // TODO: is that the correct uid?
        type: question.type,
        labels: question.labels,
        options: question.options,
        response: '',
      }
      if ('choices' in question) {
        output.additionalFields = {
          choices: question.choices,
        }
      }
      return output
    }) ?? []
  )
}

/**
 * Updates the responses (AKA answers to analysis questions) in existing
 * internal questions list using the API endpoint response.
 */
export function applyUpdateResponseToInternalQuestions(
  xpath: string,
  updateResp: DataSupplementResponse,
  questions: AnalysisQuestionInternal[],
): AnalysisQuestionInternal[] {
  const newQuestions = clonedeep(questions)
  const analysisResponses = recordEntries(updateResp[xpath]?.[ActionEnum.manual_qual] ?? {})
  newQuestions.forEach((question) => {
    const foundResponse = analysisResponses.find(([uuid, _analResp]) => question.uuid === uuid)

    if (foundResponse) {
      // QUAL_INTEGER CONVERSION HACK (PART 2/2):
      // Before putting the responses stored on Back end into the reducer, we
      // need to convert `qual_integer` response to string (from integer).
      const value = foundResponse[1]._versions[0]._data.value
      if (typeof value === 'number') {
        question.response = String(value)
      } else {
        question.response = value || ''
      }
    }
  })
  return newQuestions
}

/** Update a question in a list of questions preserving existing response. */
export function updateSingleQuestionPreservingResponse(
  questionToUpdate: AnalysisQuestionInternal,
  questions: AnalysisQuestionInternal[],
): AnalysisQuestionInternal[] {
  return clonedeep(questions).map((question) => {
    if (question.uuid === questionToUpdate.uuid) {
      // Preserve exsiting response, but update everything else
      return { ...questionToUpdate, response: question.response }
    } else {
      return question
    }
  })
}

/**
 * A function that updates the question definitions, i.e. the schema in the
 * advanced features of current asset.
 */
export async function updateSurveyQuestions(assetUid: string, questions: AnalysisQuestionInternal[]) {
  // Step 1: Make sure not to mutate existing object
  const advancedFeatures = clonedeep(getAssetAdvancedFeatures(assetUid))

  if (!advancedFeatures) {
    notify(NO_FEATURE_ERROR, 'error')
    return Promise.reject(NO_FEATURE_ERROR)
  }

  // Step 2: make sure `qual` is an object
  if (!advancedFeatures.qual) {
    advancedFeatures.qual = {}
  }

  // Step 3: prepare the data for the endpoint
  advancedFeatures.qual.qual_survey = convertQuestionsFromInternalToSchema(questions)

  // Step 4: Update the data (yay!)
  try {
    const response = await fetchPatch<AdvancedFeatureResponseManualQual>(
      endpoints.ASSET_URL.replace(':uid', assetUid),
      { advanced_features: advancedFeatures as Json },
      // The `updateSurveyQuestions` function can fail for other reasons too, so
      // we rely on the error displaying to be handled elsewhere - to avoid
      // duplicated notifications
      { notifyAboutError: false },
    )

    // TODO think of better way to handle this
    //
    // UPDATE ADVANCED FEATURES HACK (PART 2/2):
    // We need to let the `assetStore` know about the change, because
    // `analysisQuestions.reducer` is using `assetStore` to build the initial
    // list of questions every time user (re-)visits "Analysis" tab.
    // Without this line, user could see some old data.
    // assetStore.onUpdateAssetCompleted(response)

    return response
  } catch (err) {
    return Promise.reject(err)
  }
}

/**
 * A function that updates the response for a question (i.e. the submission
 * data) on the Back end.
 */
async function updateResponse(
  processingUrl: string,
  submissionUid: string,
  xpath: string,
  analysisQuestionUuid: string,
  analysisQuestionType: AnalysisQuestionType,
  newResponse: string | string[] | number | null,
) {
  try {
    const payload: AnalysisResponseUpdateRequest = {
      submission: submissionUid,
      [xpath]: {
        qual: [
          {
            uuid: analysisQuestionUuid,
            type: analysisQuestionType,
            val: newResponse,
          },
        ],
      },
    }

    const apiResponse = await fetchPostUrl<AdvancedFeatureResponseManualQual>(
      processingUrl,
      payload as Json,
      // We handle the errors in the `updateResponseAndReducer` function.
      { notifyAboutError: false },
    )

    return {
      apiResponse: apiResponse,
      xpath: xpath,
    }
  } catch (err) {
    return Promise.reject(err)
  }
}

/**
 * A wrapper function for `updateResponse` that works with a reducer passed as
 * one of parameters. We use it to make the code more DRY, as most response
 * forms use the same code to store responses.
 *
 * Assumption 1: we assume that the data is being updated for the asset and
 * the submission currently being loaded by `singleProcessingStore`.
 *
 * Assumption 2: we assume that the `dispatch` passed here is from the
 * `analysisQuestions.context`.
 *
 * Note: all of the parameters are required for this function to actually save
 * some information, but it's easier to handle TypeScript nagging in one place
 * than in each one using this function, so we do it this ugly-ish way.
 */
export async function updateResponseAndReducer(
  dispatch: React.Dispatch<AnalysisQuestionsAction>,
  surveyQuestionXpath: string,
  analysisQuestionUuid: string,
  analysisQuestionType: AnalysisQuestionType,
  response: string | string[],
  assetUid: string,
  submissionId: string,
) {
  // Double check before removing this check (we no longer have to activate NLP features)
  const processingUrl = buildSubmissionSupplementUrl(assetUid, surveyQuestionXpath)
  if (!processingUrl) {
    notify(NO_FEATURE_ERROR, 'error')
    return
  }

  // Step 1: Let the reducer know what we're about to do
  dispatch({ type: 'updateResponse' })

  // Step 2: QUAL_INTEGER CONVERSION HACK (PART 1/2):
  // For code simplicity (I hope so!) we handle `qual_integer` as string and
  // only convert it to/from actual integer when talking with Back end.
  let actualResponse: string | string[] | number | null = response
  if (analysisQuestionType === 'qual_integer') {
    const actualResponseAsNumber = Number.parseInt(String(response))
    if (Number.isInteger(actualResponseAsNumber)) {
      actualResponse = Number.parseInt(String(response))
    } else {
      if (String(response) !== '') {
        // This really shouldn't happen!
        Sentry.captureMessage(`Invalid qual_integer response: "${response}"`)
      }
      // An empty response should be represented as `null`. For continuity with
      // existing code, invalid responses are also transformed to `null` before
      // sending to the back end
      actualResponse = null
    }
  }

  // Step 3: Store the response using the `advanced_submission_post` API
  try {
    const result = await updateResponse(
      processingUrl,
      submissionId,
      surveyQuestionXpath,
      analysisQuestionUuid,
      analysisQuestionType,
      actualResponse,
    )

    // Step 4A: tell reducer about success
    dispatch({
      type: 'updateResponseCompleted',
      payload: result,
    })
  } catch (err) {
    // Step 4B: tell reducer about failure
    handleApiFail(err as FailResponse)
    dispatch({ type: 'updateResponseFailed' })
  }
}
