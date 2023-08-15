import type {AnalysisQuestionsState} from './analysisQuestions.reducer';
import type {AnalysisQuestionsAction} from './analysisQuestions.actions';
import type {
  AnalysisQuestionInternal,
  AnalysisQuestionType,
  AnalysisQuestionSchema,
  AnalysisResponseUpdateRequest,
  SubmissionProcessingDataResponse,
} from './constants';
import {ANALYSIS_QUESTION_TYPES} from './constants';
import {fetchPatch, fetchPostUrl} from 'js/api';
import {endpoints} from 'js/api.endpoints';
import {getAssetAdvancedFeatures, getAssetProcessingUrl} from 'js/assetUtils';
import clonedeep from 'lodash.clonedeep';
import {NO_FEATURE_ERROR} from '../processingActions';
import {notify} from 'js/utils';
import type {AssetAdvancedFeatures, AssetResponse} from 'js/dataInterface';
import type {Json} from '../../common/common.interfaces';
import assetStore from 'js/assetStore';

/** Finds given question in state */
export function findQuestion(
  uuid: string,
  state: AnalysisQuestionsState | undefined
) {
  return state?.questions.find((question) => question.uuid === uuid);
}

export function getQuestionTypeDefinition(type: AnalysisQuestionType) {
  return ANALYSIS_QUESTION_TYPES.find((definition) => definition.type === type);
}

/**
 * Builds schema definitions from question definitions. Useful for updating
 * questions definitions on endpoint.
 */
export function convertQuestionsFromInternalToSchema(
  /** The qpath of the asset question to which the analysis questions will refer */
  qpath: string,
  questions: AnalysisQuestionInternal[]
): AnalysisQuestionSchema[] {
  return questions.map((question) => {
    return {
      uuid: question.uuid,
      type: question.type,
      labels: question.labels,
      choices: question.additionalFields?.choices,
      scope: 'by_question#survey',
      qpath: qpath,
    };
  });
}

/**
 * Build question definitions from schema definitions. Useful for initializing
 * the analysis questions UI after loading existing question definitions from
 * schema.
 */
export function convertQuestionsFromSchemaToInternal(
  questions: AnalysisQuestionSchema[]
): AnalysisQuestionInternal[] {
  return questions.map((question) => {
    const output: AnalysisQuestionInternal = {
      uuid: question.uuid,
      type: question.type,
      labels: question.labels,
      response: '',
    };
    if (question.choices) {
      output.additionalFields = {
        choices: question.choices,
      };
    }
    return output;
  });
}

/**
 * Updates the responses (AKA answers to analysis questions) in existing
 * internal questions list using the API endpoint response.
 */
export function applyUpdateResponseToInternalQuestions(
  qpath: string,
  updateResp: SubmissionProcessingDataResponse,
  questions: AnalysisQuestionInternal[]
): AnalysisQuestionInternal[] {
  const newQuestions = clonedeep(questions);
  const analysisResponses = updateResp[qpath]?.qual || [];
  newQuestions.forEach((question) => {
    const foundResponse = analysisResponses.find(
      (analResp) => question.uuid === analResp.uuid
    );
    if (foundResponse) {
      if (Array.isArray(foundResponse.val)) {
        question.response = foundResponse.val.join(',');
      } else {
        question.response = foundResponse.val;
      }
    }
  });
  return newQuestions;
}

export function getQuestionsFromSchema(
  advancedFeatures?: AssetAdvancedFeatures
): AnalysisQuestionInternal[] {
  return convertQuestionsFromSchemaToInternal(
    advancedFeatures?.qual?.qual_survey || []
  );
}

/**
 * A function that updates the question definitions, i.e. the schema in the
 * advanced features of current asset.
 */
export async function updateSurveyQuestions(
  assetUid: string,
  /**
   * We allow `undefined`, because `singleProcessingStore.currentQuestion.qpath`
   * can be `undefined`.
   */
  qpath: string | undefined,
  questions: AnalysisQuestionInternal[]
) {
  const advancedFeatures = clonedeep(getAssetAdvancedFeatures(assetUid));

  if (!advancedFeatures || !qpath) {
    notify(NO_FEATURE_ERROR, 'error');
    return Promise.reject(NO_FEATURE_ERROR);
  }

  if (!advancedFeatures.qual) {
    advancedFeatures.qual = {};
  }

  advancedFeatures.qual.qual_survey = convertQuestionsFromInternalToSchema(
    qpath,
    questions
  );

  // TODO: add try catch error handling
  const response = await fetchPatch<AssetResponse>(
    endpoints.ASSET_URL.replace(':uid', assetUid),
    {advanced_features: advancedFeatures as Json}
  );

  // TODO think of better way to handle this
  //
  // HACK: We need to let the `assetStore` know about the change, because
  // `analysisQuestions.reducer` is using `assetStore` to build the initial
  // list of questions every time user (re-)visits "Analysis" tab.
  // Without this line, user could see some old data.
  assetStore.onUpdateAssetCompleted(response);

  return response;
}

/**
 * A function that updates the response for a question, i.e. the submission data.
 * TODO: see if this really needs so much parameters
 */
export async function updateResponse(
  assetUid: string,
  submissionUid: string,
  qpath: string,
  analysisQuestionUuid: string,
  analysisQuestionType: AnalysisQuestionType,
  newResponse: string
) {
  const processingUrl = getAssetProcessingUrl(assetUid);
  if (!processingUrl) {
    return Promise.reject();
  }

  // TODO: this needs
  // 1. to send different objects for diffferent question types
  try {
    const payload: AnalysisResponseUpdateRequest = {
      submission: submissionUid,
      [qpath]: {
        qual: [
          {
            uuid: analysisQuestionUuid,
            type: analysisQuestionType,
            val: newResponse,
          },
        ],
      },
    };

    const apiResponse = await fetchPostUrl<SubmissionProcessingDataResponse>(
      processingUrl,
      payload as Json
    );

    return {
      apiResponse: apiResponse,
      qpath: qpath,
    };
  } catch (err) {
    // TODO: do something here
    console.log(err);
    return Promise.reject(err);
  }
}

/**
 * TODO: delete this function
 * A function that updates the response for a question, i.e. the submission data.
 */
export function quietlyUpdateResponse(
  state: AnalysisQuestionsState | undefined,
  dispatch: React.Dispatch<AnalysisQuestionsAction> | undefined,
  questionUuid: string,
  response: string
) {
  if (!state || !dispatch) {
    return;
  }

  dispatch({type: 'updateResponse'});

  // TODO make actual API call here
  // For now we make a fake response
  console.log('QA fake API call: update response', questionUuid, response);
  // setTimeout(() => {
  //   console.log('QA fake API call: update response DONE');
  //   dispatch({
  //     type: 'updateResponseCompleted',
  //     payload: {
  //       questions: state.questions.map((item) => {
  //         if (item.uuid === questionUuid) {
  //           return {
  //             ...item,
  //             response: response,
  //           };
  //         } else {
  //           return item;
  //         }
  //       }),
  //     },
  //   });
  // }, 1000);
}
