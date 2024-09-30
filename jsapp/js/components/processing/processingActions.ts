/**
 * This file lists all different processing related Reflux actions. Some of
 * these are simple API calls, but few requires chain calls.
 *
 * TODO: in future, this should be moved to MobX or a reducer.
 */

import Reflux from 'reflux';
import {notify} from 'alertifyjs';
import clonedeep from 'lodash.clonedeep';
import {actions} from 'js/actions';
import {getAssetAdvancedFeatures, getAssetProcessingUrl} from 'js/assetUtils';
import type {
  AssetAdvancedFeatures,
  AssetResponse,
  FailResponse,
} from 'js/dataInterface';
import type {LanguageCode} from 'js/components/languages/languagesStore';

/**
 * A safety check error message for calls made with assets that don't have
 * the processing enabled.
 */
export const NO_FEATURE_ERROR = t(
  'Asset seems to not have the processing feature enabled!'
);

/**
 * A temporary solution for deleting transcript/translation is to pass this
 * character as value instead of making a `DELETE` call.
 */
const DELETE_CHAR = '⌫';

/** Response from Google for automated transcript. */
interface GoogleTsResponse {
  status: 'requested' | 'in_progress' | 'complete' | 'error';
  /** Full transcript text. */
  value: string;
  /** Transcript text split into chunks - scored by transcription quality. */
  fullResponse: Array<{
    transcript: string;
    confidence: number;
  }>;
  languageCode: string;
  regionCode: string | null;
}

/** Response from Google for automated translation. */
interface GoogleTxResponse {
  status: 'requested' | 'in_progress' | 'complete' | 'error';
  value: string;
  languageCode: string;
}

/**
 * An object we are sending to Back end whenever we want to save new transcript
 * or translation value.
 */
interface TransxRequestObject {
  languageCode: LanguageCode;
  value: string;
}

/**
 * An object we are receiving from Back end for a transcript or a translation.
 */
export interface TransxObject extends TransxRequestObject {
  dateCreated: string;
  dateModified: string;
  /** The source of the `value` text. */
  engine?: string;
  /** The history of edits. */
  revisions?: Array<{
    dateModified: string;
    engine?: string;
    languageCode: LanguageCode;
    value: string;
  }>;
}

/** Object we send to Back end when updating transcript text manually. */
interface TranscriptRequest {
  [xpath: string]: string | undefined | {transcript: TransxRequestObject};
  submission?: string;
}

/** Object we send to Back end when requesting an automatic transcription. */
interface AutoTranscriptRequest {
  [xpath: string]:
    | string
    | undefined
    | {googlets: AutoTranscriptRequestEngineParams};
  submission?: string;
}
interface AutoTranscriptRequestEngineParams {
  status: 'requested';
  languageCode?: string;
  regionCode?: string;
}

/** Object we send to Back end when updating translation text manually. */
interface TranslationRequest {
  [xpath: string]:
    | string
    | undefined
    | {translation: TranslationsRequestObject};
  submission?: string;
}
interface TranslationsRequestObject {
  [languageCode: LanguageCode]: TransxRequestObject;
}

/** Object we send to Back end when requesting an automatic translation. */
interface AutoTranslationRequest {
  [xpath: string]:
    | string
    | undefined
    | {googletx: AutoTranslationRequestEngineParams};
  submission?: string;
}
interface AutoTranslationRequestEngineParams {
  status: 'requested';
  languageCode: string;
}

/**
 * This is a list of question objects returned from processing endpoint. They
 * contain a transcript and all translations for given question. If automated
 * tools were used, it will also contain the responses from these tools.
 */
export interface ProcessingDataResponse {
  [key: string]: {
    transcript: TransxObject;
    translation: {
      [languageCode: LanguageCode]: TransxObject;
    };
    googlets?: GoogleTsResponse;
    googletx?: GoogleTxResponse;
  };
}

/**
 * This is a Reflux thing. A function that can be called, but also a function
 * that has a .listen method for adding observers to it. It helps to typeguard
 * all the Reflux actions here.
 */
interface ListenableCallback<R> extends Function {
  (response: R): void;
  listen: (callback: (response: R) => void) => Function;
}

interface ProcessingActionsDefinition {
  activateAsset: ActivateAssetDefinition;
  getProcessingData: GetProcessingDataDefinition;
  setTranscript: SetTranscriptDefinition;
  deleteTranscript: DeleteTranscriptDefinition;
  requestAutoTranscription: RequestAutoTranscriptionDefinition;
  setTranslation: SetTranslationDefinition;
  deleteTranslation: DeleteTranslationDefinition;
  requestAutoTranslation: RequestAutoTranslationDefinition;
}

const processingActions: ProcessingActionsDefinition = Reflux.createActions({
  activateAsset: {children: ['completed', 'failed']},
  getProcessingData: {children: ['started', 'completed', 'failed']},
  // Transcript stuff
  setTranscript: {children: ['completed', 'failed']},
  deleteTranscript: {children: ['completed', 'failed']},
  requestAutoTranscription: {children: ['completed', 'in_progress', 'failed']},
  // Translation stuff
  setTranslation: {children: ['completed', 'failed']},
  deleteTranslation: {children: ['completed', 'failed']},
  requestAutoTranslation: {children: ['completed', 'in_progress', 'failed']},
});

/**
 * `activateAsset` action
 *
 * Processing is database heavy, so assets need to be have the feature activated
 * first. Activations requires providing a lists of question names and a lists
 * of language codes - this means that asset might be re-activated multiple
 * times, e.g. when a new translation language is added. Back end handles
 * un-activation automagically - e.g. when you delete last translation for given
 * language, backend will un-activate that language in asset.
 */
interface ActivateAssetFn {
  (
    assetUid: string,
    enableTranscript?: boolean,
    /** To enable translations, pass array of languages (empty works too). */
    enableTranslations?: string[]
  ): void;
}
interface ActivateAssetDefinition extends ActivateAssetFn {
  listen: (fn: ActivateAssetFn) => void;
  completed: ListenableCallback<AssetResponse>;
  failed: ListenableCallback<FailResponse>;
}
processingActions.activateAsset.listen(
  (assetUid, enableTranscript, enableTranslations) => {
    const features: AssetAdvancedFeatures = {};
    if (enableTranscript) {
      features.transcript = {};
    }
    if (Array.isArray(enableTranslations)) {
      features.translation = {
        languages: enableTranslations,
      };
    }
    actions.resources.updateAsset(
      assetUid,
      {advanced_features: features},
      {
        onComplete: processingActions.activateAsset.completed,
        onFail: processingActions.activateAsset.failed,
      }
    );
  }
);

/**
 * `getProcessingData` action
 *
 * This simply returns the processing data for all questions for given
 * submission.
 */
interface GetProcessingDataFn {
  (assetUid: string, submissionEditId: string): void;
}
interface GetProcessingDataDefinition extends GetProcessingDataFn {
  listen: (fn: GetProcessingDataFn) => void;
  started: ListenableCallback<() => void>;
  completed: ListenableCallback<ProcessingDataResponse>;
  failed: ListenableCallback<FailResponse | string>;
}
processingActions.getProcessingData.listen((assetUid, submissionEditId) => {
  const processingUrl = getAssetProcessingUrl(assetUid);
  if (processingUrl === undefined) {
    processingActions.getProcessingData.failed(NO_FEATURE_ERROR);
  } else {
    const xhr = $.ajax({
      dataType: 'json',
      contentType: 'application/json',
      method: 'GET',
      url: processingUrl,
      data: {submission: submissionEditId},
    })
      .done(processingActions.getProcessingData.completed)
      .fail(processingActions.getProcessingData.failed);

    processingActions.getProcessingData.started(xhr.abort);
  }
});
processingActions.getProcessingData.failed.listen(() => {
  notify(t('Failed to get processing data.'), 'error');
});

/**
 * This DRY private method is used inside setTranslation - either as a followup
 * to another call or a lone call.
 */
function setTranscriptInnerMethod(
  assetUid: string,
  xpath: string,
  submissionEditId: string,
  languageCode: LanguageCode,
  value: string
) {
  const processingUrl = getAssetProcessingUrl(assetUid);
  if (processingUrl === undefined) {
    processingActions.setTranscript.failed(NO_FEATURE_ERROR);
  } else {
    const data: TranscriptRequest = {
      submission: submissionEditId,
    };
    data[xpath] = {
      transcript: {
        value: value,
        languageCode: languageCode,
      },
    };

    $.ajax({
      dataType: 'json',
      contentType: 'application/json',
      method: 'POST',
      url: processingUrl,
      data: JSON.stringify(data),
    })
      .done((response: ProcessingDataResponse) => {
        processingActions.setTranscript.completed(response);
      })
      .fail(processingActions.setTranscript.failed);
  }
}

/**
 * `setTranscript` action
 *
 * For updating the transcript text. Note that it ensures that asset's
 * `advanced_features` are enabled for given language before sending transcript
 * - to avoid rejection.
 */
interface SetTranscriptFn {
  (
    assetUid: string,
    xpath: string,
    submissionEditId: string,
    languageCode: LanguageCode,
    value: string
  ): void;
}
interface SetTranscriptDefinition extends SetTranscriptFn {
  listen: (fn: SetTranscriptFn) => void;
  completed: ListenableCallback<ProcessingDataResponse>;
  failed: ListenableCallback<FailResponse | string>;
}
processingActions.setTranscript.listen(
  (assetUid, xpath, submissionEditId, languageCode, value) => {
    // This first block of code is about getting currently enabled languages.
    const currentFeatures = getAssetAdvancedFeatures(assetUid);
    if (currentFeatures?.transcript === undefined) {
      processingActions.setTranscript.failed(NO_FEATURE_ERROR);
      return;
    }

    // Case 1: the language is already enabled in advanced_features, so we can
    // just send the translation.
    if (
      Array.isArray(currentFeatures.transcript.languages) &&
      currentFeatures.transcript.languages.includes(languageCode)
    ) {
      setTranscriptInnerMethod(
        assetUid,
        xpath,
        submissionEditId,
        languageCode,
        value
      );
      return;
    }

    // Case 2: the language is not yet enabled, so we make a chain call that
    // will enable it and then send the translation

    // We build the updated advanced_features object.
    const newFeatures: AssetAdvancedFeatures = clonedeep(currentFeatures);
    if (!newFeatures.transcript) {
      newFeatures.transcript = {};
    }
    if (Array.isArray(newFeatures.transcript.languages)) {
      newFeatures.transcript.languages.push(languageCode);
    } else {
      newFeatures.transcript.languages = [languageCode];
    }

    // We update the asset and go with the next call on success.
    actions.resources.updateAsset(
      assetUid,
      {advanced_features: newFeatures},
      {
        onComplete: setTranscriptInnerMethod.bind(
          this,
          assetUid,
          xpath,
          submissionEditId,
          languageCode,
          value
        ),
        onFail: processingActions.setTranscript.failed,
      }
    );
  }
);
processingActions.setTranscript.failed.listen(() => {
  notify(t('Failed to set transcript.'), 'error');
});

/**
 * `deleteTranscript` action
 *
 * Use it to completely remove given transcript. Currently deleting transcript
 * means setting its value to a predefined DELETE_CHAR. Back end handles the
 * cleanup - it removes the transcript, and if there is zero transcripts for
 * given language for all the submissions, it also removes that language from
 * `advanced_feature` (i.e. makes it "not enabled").
 */
interface DeleteTranscriptFn {
  (assetUid: string, xpath: string, submissionEditId: string): void;
}
interface DeleteTranscriptDefinition extends DeleteTranscriptFn {
  listen: (fn: DeleteTranscriptFn) => void;
  completed: ListenableCallback<ProcessingDataResponse>;
  failed: ListenableCallback<FailResponse | string>;
}
processingActions.deleteTranscript.listen(
  (assetUid, xpath, submissionEditId) => {
    const processingUrl = getAssetProcessingUrl(assetUid);
    if (processingUrl === undefined) {
      processingActions.deleteTranscript.failed(NO_FEATURE_ERROR);
    } else {
      const data: TranscriptRequest = {
        submission: submissionEditId,
      };
      data[xpath] = {
        transcript: {
          value: DELETE_CHAR,
          languageCode: '',
        },
      };

      $.ajax({
        dataType: 'json',
        contentType: 'application/json',
        method: 'POST',
        url: processingUrl,
        data: JSON.stringify(data),
      })
        .done(processingActions.deleteTranscript.completed)
        .fail(processingActions.deleteTranscript.failed);
    }
  }
);
processingActions.deleteTranscript.failed.listen(() => {
  notify(t('Failed to delete transcript.'), 'error');
});

/**
 * `requestAutoTranscription` action
 *
 * For requesting automatic transcription from Back end. It uses an in-progress
 * callback called `in_progress`. We use it because transcripting process can
 * take a long time.
 *
 * Note: if user sends the same request multiple times, Back end will respond
 * with initial request status instead of making a completely new call.
 */
interface RequestAutoTranscriptionFn {
  (
    assetUid: string,
    xpath: string,
    submissionEditId: string,
    languageCode?: string,
    regionCode?: string | null
  ): void;
}
interface RequestAutoTranscriptionDefinition
  extends RequestAutoTranscriptionFn {
  listen: (fn: RequestAutoTranscriptionFn) => void;
  completed: ListenableCallback<{
    response: ProcessingDataResponse;
    submissionEditId: string;
  }>;
  in_progress: ListenableCallback<{
    response: ProcessingDataResponse;
    submissionEditId: string;
  }>;
  failed: ListenableCallback<FailResponse | string>;
}
processingActions.requestAutoTranscription.listen(
  (assetUid, xpath, submissionEditId, languageCode, regionCode) => {
    const processingUrl = getAssetProcessingUrl(assetUid);
    if (processingUrl === undefined) {
      processingActions.requestAutoTranscription.failed(NO_FEATURE_ERROR);
    } else {
      const data: AutoTranscriptRequest = {
        submission: submissionEditId,
      };
      const autoparams: AutoTranscriptRequestEngineParams = {
        status: 'requested',
      };
      if (languageCode) {
        autoparams.languageCode = languageCode;
      }
      if (regionCode) {
        autoparams.regionCode = regionCode;
      }
      data[xpath] = {
        googlets: autoparams,
      };

      $.ajax({
        dataType: 'json',
        contentType: 'application/json',
        method: 'POST',
        url: processingUrl,
        data: JSON.stringify(data),
      })
        .done((response: ProcessingDataResponse) => {
          const responseStatus = response[xpath]?.googlets?.status;

          if (responseStatus === 'requested' || responseStatus === 'in_progress') {
            processingActions.requestAutoTranscription.in_progress({
              response,
              submissionEditId,
            });
          } else if (responseStatus === 'error') {
            processingActions.requestAutoTranscription.failed('unknown error');
          } else {
            processingActions.requestAutoTranscription.completed({
              response,
              submissionEditId,
            });
          }
        })
        .fail(processingActions.requestAutoTranscription.failed);
    }
  }
);

/** A small utility function for getting easier to use data. */
function pickTranslationsFromProcessingDataResponse(
  response: ProcessingDataResponse,
  xpath: string
): TransxObject[] {
  const translations: TransxObject[] = [];
  Object.values(response[xpath]?.translation).forEach((translation) => {
    translations.push(translation);
  });
  return translations;
}

/** A function that builds translation data object for processing endpoint. */
function getTranslationDataObject(
  xpath: string,
  submissionEditId: string,
  languageCode: LanguageCode,
  value: string
): TranslationRequest {
  // Sorry for this object being built in such a lengthy way, but it is needed
  // so for typings.
  const translationsObj: TranslationsRequestObject = {};
  translationsObj[languageCode] = {
    value: value,
    languageCode: languageCode,
  };
  const data: TranslationRequest = {
    submission: submissionEditId,
  };
  data[xpath] = {
    translation: translationsObj,
  };
  return data;
}

/**
 * This DRY private method is used inside setTranslation - either as a followup
 * to another call or a lone call.
 */
function setTranslationInnerMethod(
  assetUid: string,
  xpath: string,
  submissionEditId: string,
  languageCode: LanguageCode,
  value: string
) {
  const processingUrl = getAssetProcessingUrl(assetUid);
  if (processingUrl === undefined) {
    processingActions.setTranslation.failed(NO_FEATURE_ERROR);
  } else {
    const data = getTranslationDataObject(
      xpath,
      submissionEditId,
      languageCode,
      value
    );
    $.ajax({
      dataType: 'json',
      contentType: 'application/json',
      method: 'POST',
      url: processingUrl,
      data: JSON.stringify(data),
    })
      .done((response: ProcessingDataResponse) => {
        processingActions.setTranslation.completed(
          pickTranslationsFromProcessingDataResponse(response, xpath)
        );
      })
      .fail(processingActions.setTranslation.failed);
  }
}

/**
 * `setTranslation` action
 *
 * For updating the translation text. Note that it ensures that asset's
 * `advanced_features` are enabled for given language before sending translation
 * - to avoid rejection.
 */
interface SetTranslationFn {
  (
    assetUid: string,
    xpath: string,
    submissionEditId: string,
    languageCode: LanguageCode,
    value: string
  ): void;
}
interface SetTranslationDefinition extends SetTranslationFn {
  listen: (fn: SetTranslationFn) => void;
  completed: ListenableCallback<TransxObject[]>;
  failed: ListenableCallback<FailResponse | string>;
}
processingActions.setTranslation.listen(
  (assetUid, xpath, submissionEditId, languageCode, value) => {
    // This first block of code is about getting currently enabled languages.
    const currentFeatures = getAssetAdvancedFeatures(assetUid);
    if (currentFeatures?.translation === undefined) {
      processingActions.setTranslation.failed(NO_FEATURE_ERROR);
      return;
    }

    // Case 1: the language is already enabled in advanced_features, so we can
    // just send the translation.
    if (
      Array.isArray(currentFeatures.translation.languages) &&
      currentFeatures.translation.languages.includes(languageCode)
    ) {
      setTranslationInnerMethod(
        assetUid,
        xpath,
        submissionEditId,
        languageCode,
        value
      );
      return;
    }

    // Case 2: the language is not yet enabled, so we make a chain call that will
    // enable it and then send the translation

    // We build the updated advanced_features object.
    const newFeatures: AssetAdvancedFeatures = clonedeep(currentFeatures);
    if (!newFeatures.translation) {
      newFeatures.translation = {};
    }
    if (Array.isArray(newFeatures.translation.languages)) {
      newFeatures.translation.languages.push(languageCode);
    } else {
      newFeatures.translation.languages = [languageCode];
    }

    // We update the asset and go with the next call on success.
    actions.resources.updateAsset(
      assetUid,
      {advanced_features: newFeatures},
      {
        onComplete: setTranslationInnerMethod.bind(
          this,
          assetUid,
          xpath,
          submissionEditId,
          languageCode,
          value
        ),
        onFail: processingActions.setTranslation.failed,
      }
    );
  }
);
processingActions.setTranslation.failed.listen(() => {
  notify(t('Failed to set transcript.'), 'error');
});

/**
 * `deleteTranslation` action
 *
 * Use it to completely remove given translation. Currently deleting translation
 * means setting its value to a predefined DELETE_CHAR. Back end handles the
 * cleanup - it removes the translation, and if there is zero translations for
 * given language for all the submissions, it also removes that language from
 * `advanced_feature` (i.e. makes it "not enabled").
 */
interface DeleteTranslationFn {
  (
    assetUid: string,
    xpath: string,
    submissionEditId: string,
    languageCode: LanguageCode
  ): void;
}
interface DeleteTranslationDefinition extends DeleteTranslationFn {
  listen: (fn: DeleteTranslationFn) => void;
  completed: ListenableCallback<ProcessingDataResponse>;
  failed: ListenableCallback<FailResponse | string>;
}
processingActions.deleteTranslation.listen(
  (assetUid, xpath, submissionEditId, languageCode) => {
    const processingUrl = getAssetProcessingUrl(assetUid);
    if (processingUrl === undefined) {
      processingActions.deleteTranslation.failed(NO_FEATURE_ERROR);
    } else {
      const data = getTranslationDataObject(
        xpath,
        submissionEditId,
        languageCode,
        DELETE_CHAR
      );
      $.ajax({
        dataType: 'json',
        contentType: 'application/json',
        method: 'POST',
        url: processingUrl,
        data: JSON.stringify(data),
      })
        .done(processingActions.deleteTranslation.completed)
        .fail(processingActions.deleteTranslation.failed);
    }
  }
);
processingActions.deleteTranslation.failed.listen(() => {
  notify(t('Failed to delete translation.'), 'error');
});

/**
 * `requestAutoTranslation` action
 *
 * For requestiong automatic translation from Back end. Translations are not as
 * time consuming as transcripts, but we also use `in_progress` callback here,
 * as it's needed for text longer than ~30k characters.
 */
interface RequestAutoTranslationFn {
  (
    assetUid: string,
    xpath: string,
    submissionEditId: string,
    languageCode: string
  ): void;
}
interface RequestAutoTranslationDefinition extends RequestAutoTranslationFn {
  listen: (fn: RequestAutoTranslationFn) => void;
  completed: ListenableCallback<{
    response: ProcessingDataResponse;
    submissionEditId: string;
  }>;
  in_progress: ListenableCallback<{
    response: ProcessingDataResponse;
    submissionEditId: string;
  }>;
  failed: ListenableCallback<FailResponse | string>;
}
processingActions.requestAutoTranslation.listen(
  (assetUid, xpath, submissionEditId, languageCode) => {
    const processingUrl = getAssetProcessingUrl(assetUid);
    if (processingUrl === undefined) {
      processingActions.requestAutoTranslation.failed(NO_FEATURE_ERROR);
    } else {
      const data: AutoTranslationRequest = {
        submission: submissionEditId,
      };
      data[xpath] = {
        googletx: {
          status: 'requested',
          languageCode: languageCode,
        },
      };

      $.ajax({
        dataType: 'json',
        contentType: 'application/json',
        method: 'POST',
        url: processingUrl,
        data: JSON.stringify(data),
      })
        .done((response: ProcessingDataResponse) => {
          const responseStatus = response[xpath]?.googletx?.status;

          if (responseStatus === 'requested' || responseStatus === 'in_progress') {
            processingActions.requestAutoTranslation.in_progress({
              response,
              submissionEditId,
            });
          } else if (responseStatus === 'error') {
            processingActions.requestAutoTranslation.failed('unknown error');
          } else {
            processingActions.requestAutoTranslation.completed({
              response,
              submissionEditId,
            });
          }
        })
        .fail(processingActions.requestAutoTranslation.failed);
    }
  }
);

export default processingActions;
