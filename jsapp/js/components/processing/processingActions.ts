import Reflux from 'reflux';
import {notify} from 'alertifyjs';
import clonedeep from 'lodash.clonedeep';
import {actions} from 'js/actions';
import {
  getAssetAdvancedFeatures,
  getAssetProcessingUrl,
} from 'js/assetUtils';
import type {AssetAdvancedFeatures} from 'js/dataInterface';
import type {LanguageCode} from 'js/components/languages/languagesStore';

const NO_FEATURE_ERROR = t('Asset seems to not have the processing feature enabled!');

// A temporary solution for deleting transcript/translation is to pass this
// character as value.
const DELETE_CHAR = '⌫';

interface GoogleTsResponse {
  status: 'requested' | 'in_progress' | 'complete';
  /** Full transcript text. */
  value: string;
  /** Transcript text split into chunks - scored by transcription quality. */
  fullResponse: Array<{
    transcript: string;
    confidence: number;
  }>;
  languageCode: string;
}

interface GoogleTxResponse {
  status: 'complete';
  value: string;
  languageCode: string;
}

interface TransxQuestion {
  transcript: TransxObject;
  translation: {
    [languageCode: LanguageCode]: TransxObject;
  };
  googlets?: GoogleTsResponse;
  googletx?: GoogleTxResponse;
}
/** Both transcript and translation are built in same way. */
interface TransxRequestObject {
  languageCode: LanguageCode;
  value: string;
}
interface TransxObject extends TransxRequestObject {
  dateCreated: string;
  dateModified: string;
  engine?: string;
  revisions?: TransxRevision[];
}
interface TransxRevision {
  dateModified: string;
  engine?: string;
  languageCode: LanguageCode;
  value: string;
}

interface TranscriptRequest {
  [qpath: string]: TranscriptRequestQuestion | string | undefined;
  submission?: string;
}
interface TranscriptRequestQuestion {
  transcript: TransxRequestObject;
}

interface AutoTranscriptRequest {
  [qpath: string]: AutoTranscriptRequestQuestion | string | undefined;
  submission?: string;
}
interface AutoTranscriptRequestEngineParams {
  status: 'requested';
  languageCode?: string;
  regionCode?: string;
}
interface AutoTranscriptRequestQuestion {
  googlets: AutoTranscriptRequestEngineParams;
}

interface TranslationRequest {
  [qpath: string]: TranslationRequestQuestion | string | undefined;
  submission?: string;
}
interface TranslationRequestQuestion {
  translation: TranslationsRequestObject;
}
interface TranslationsRequestObject {
  [languageCode: LanguageCode]: TransxRequestObject;
}

interface AutoTranslationRequest {
  [qpath: string]: AutoTranslationRequestQuestion | string | undefined;
  submission?: string;
}
interface AutoTranslationRequestQuestion {
  googletx: {
    status: 'requested';
    languageCode: string;
  };
}

export interface ProcessingDataResponse {
  [key: string]: TransxQuestion;
}
export interface AutoTranscriptionEvent {
  response: ProcessingDataResponse;
  submissionEditId: string;
}

const processingActions = Reflux.createActions({
  activateAsset: {children: ['completed', 'failed']},
  getProcessingData: {
    children: [
      'started',
      'completed',
      'failed',
    ],
  },
  // Transcript stuff
  setTranscript: {children: ['completed', 'failed']},
  deleteTranscript: {children: ['completed', 'failed']},
  requestAutoTranscription: {children: ['completed', 'in_progress', 'failed']},
  // Translation stuff
  setTranslation: {children: ['completed', 'failed']},
  deleteTranslation: {children: ['completed', 'failed']},
  requestAutoTranslation: {children: ['completed', 'failed']},
});

/**
 * Processing is database heavy, so assets need to be have the feature activated
 * first. Activations requires providing a lists of question names and a lists
 * processingActions.requestAutoTranscription.in_progress(response);
 * of language codes - this means that asset might be re-activated multiple
 * times, e.g. when a new translation language is added. Backend handles
 * un-activation automagically - e.g. when you delete last translation for given
 * language, backend will un-activate that language in asset.
 */
processingActions.activateAsset.listen((
  assetUid: string,
  enableTranscript?: boolean,
  /** To enable translations, pass array of languages (empty works too). */
  enableTranslations?: string[]
) => {
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
});

processingActions.getProcessingData.listen((
  assetUid: string,
  submissionEditId: string
) => {
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
      .done((response: ProcessingDataResponse) => {
        processingActions.getProcessingData.completed(response);
      })
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
  qpath: string,
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
    data[qpath] = {
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

// This function ensures that `advanced_features` are enabled for given language
// before sending translation to avoid rejection.
processingActions.setTranscript.listen((
  assetUid: string,
  qpath: string,
  submissionEditId: string,
  languageCode: LanguageCode,
  value: string
) => {
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
      qpath,
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
        qpath,
        submissionEditId,
        languageCode,
        value
      ),
      onFail: processingActions.setTranscript.failed,
    }
  );
});
processingActions.setTranscript.failed.listen(() => {
  notify(t('Failed to set transcript.'), 'error');
});

/**
 * For now deleting transcript means setting its value to
 * a predefined DELETE_CHAR.
 */
processingActions.deleteTranscript.listen((
  assetUid: string,
  qpath: string,
  submissionEditId: string
) => {
  const processingUrl = getAssetProcessingUrl(assetUid);
  if (processingUrl === undefined) {
    processingActions.deleteTranscript.failed(NO_FEATURE_ERROR);
  } else {
    const data: TranscriptRequest = {
      submission: submissionEditId,
    };
    data[qpath] = {
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
      .done((response: ProcessingDataResponse) => {
        processingActions.deleteTranscript.completed(response);
      })
      .fail(processingActions.deleteTranscript.failed);
  }
});
processingActions.deleteTranscript.failed.listen(() => {
  notify(t('Failed to delete transcript.'), 'error');
});

processingActions.requestAutoTranscription.listen((
  assetUid: string,
  qpath: string,
  submissionEditId: string,
  languageCode?: string,
  regionCode?: string,
) => {
  const processingUrl = getAssetProcessingUrl(assetUid);
  if (processingUrl === undefined) {
    processingActions.requestAutoTranscription.failed(NO_FEATURE_ERROR);
  } else {
    const data: AutoTranscriptRequest = {
      submission: submissionEditId,
    };
    let autoparams: AutoTranscriptRequestEngineParams = {status: 'requested'};
    if (languageCode) {
      autoparams.languageCode = languageCode;
    }
    if (regionCode) {
      autoparams.regionCode = regionCode;
    }
    data[qpath] = {
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
        if (['requested', 'in_progress'].includes(response[qpath]?.googlets?.status ?? '')) {
          processingActions.requestAutoTranscription.in_progress({response, submissionEditId});
        } else {
          processingActions.requestAutoTranscription.completed({response, submissionEditId});
        }
      })
      .fail(processingActions.requestAutoTranscription.failed);
  }
});

function pickTranslationsFromProcessingDataResponse(
  response: ProcessingDataResponse,
  qpath: string
): TransxObject[] {
  const translations: TransxObject[] = [];
  Object.values(response[qpath]?.translation).forEach((translation) => {
    translations.push(translation);
  });
  return translations;
}

/** A function that builds translation data object for processing endpoint. */
function getTranslationDataObject(
  qpath: string,
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
  data[qpath] = {
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
  qpath: string,
  submissionEditId: string,
  languageCode: LanguageCode,
  value: string
) {
  const processingUrl = getAssetProcessingUrl(assetUid);
  if (processingUrl === undefined) {
    processingActions.setTranslation.failed(NO_FEATURE_ERROR);
  } else {
    const data = getTranslationDataObject(
      qpath,
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
          pickTranslationsFromProcessingDataResponse(
            response,
            qpath
          )
        );
      })
      .fail(processingActions.setTranslation.failed);
  }
}

// This function ensures that `advanced_features` are enabled for given language
// before sending translation to avoid rejection.
processingActions.setTranslation.listen((
  assetUid: string,
  qpath: string,
  submissionEditId: string,
  languageCode: LanguageCode,
  value: string
) => {
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
      qpath,
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
        qpath,
        submissionEditId,
        languageCode,
        value
      ),
      onFail: processingActions.setTranslation.failed,
    }
  );
});
processingActions.setTranslation.failed.listen(() => {
  notify(t('Failed to set transcript.'), 'error');
});

/**
 * For now deleting translation means setting its value to
 * a predefined DELETE_CHAR.
 */
processingActions.deleteTranslation.listen((
  assetUid: string,
  qpath: string,
  submissionEditId: string,
  languageCode: LanguageCode
) => {
  const processingUrl = getAssetProcessingUrl(assetUid);
  if (processingUrl === undefined) {
    processingActions.deleteTranslation.failed(NO_FEATURE_ERROR);
  } else {
    const data = getTranslationDataObject(
      qpath,
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
      .done((response: ProcessingDataResponse) => {
        processingActions.deleteTranslation.completed(response);
      })
      .fail(processingActions.deleteTranslation.failed);
  }
});
processingActions.deleteTranslation.failed.listen(() => {
  notify(t('Failed to delete translation.'), 'error');
});

processingActions.requestAutoTranslation.listen((
  assetUid: string,
  qpath: string,
  submissionEditId: string,
  languageCode: string
) => {
  const processingUrl = getAssetProcessingUrl(assetUid);
  if (processingUrl === undefined) {
    processingActions.requestAutoTranslation.failed(NO_FEATURE_ERROR);
  } else {
    const data: AutoTranslationRequest = {
      submission: submissionEditId,
    };
    data[qpath] = {
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
        processingActions.requestAutoTranslation.completed(response);
      })
      .fail(processingActions.requestAutoTranslation.failed);
  }
});

export default processingActions;
