// TODO
// 1. we need to activate translated language before we create a translation - this will require making one call before the other
// 2. we need to wait for backend to fix response and use the data from translations properly
// 3. handle deleting translations (unactivate language)

import Reflux from 'reflux'
import {notify} from 'alertifyjs'
import {actions} from 'js/actions'
import {getAssetProcessingUrl} from 'js/assetUtils'

const NO_FEATURE_ERROR = t('Asset seems to not have the processing feature enabled!')

interface TransxQuestion {
  transcript: TransxObject
  translated: {
    [languageCode: string]: TransxObject
  }
}
/** Both transcript and translation are built in same way. */
interface TransxRequestObject {
  languageCode: string
  value: string
}
interface TransxObject extends TransxRequestObject {
  dateCreated: string
  dateModified: string
  engine?: string
  revisions?: TransxRevision[]
}
interface TransxRevision {
  dateModified: string
  engine?: string
  languageCode: string
  value: string
}

interface TranscriptRequest {
  [questionName: string]: TranscriptRequestQuestion | string | undefined
  submission?: string
}
interface TranscriptRequestQuestion {
  transcript: TransxRequestObject
}

interface TranslationRequest {
  [questionName: string]: TranslationRequestQuestion | string | undefined
  submission?: string
}
interface TranslationRequestQuestion {
  translated: TranslationsRequestObject
}
interface TranslationsRequestObject {
  [languageCode: string]: TransxRequestObject
}

export interface ProcessingDataResponse {
  [key: string]: TransxQuestion
}

const processingActions = Reflux.createActions({
  activateAsset: {children: ['completed', 'failed']},
  getProcessingData: {
    children: [
      'started',
      'completed',
      'failed'
    ]
  },
  setTranscript: {children: ['completed', 'failed']},
  deleteTranscript: {children: ['completed', 'failed']},
  setTranslation: {children: ['completed', 'failed']},
  deleteTranslation: {children: ['completed', 'failed']}
})

processingActions.activateAsset.listen((
  assetUid: string,
  enableTranscript?: boolean,
  /** To enable translations, pass array of languages (empty works too). */
  enableTranslations?: string[]
) => {
  const features: {transcript?: object, translated?: object} = {}
  if (enableTranscript) {
    features.transcript = {}
  }
  if (Array.isArray(enableTranslations)) {
    features.translated = {
      languages: enableTranslations
    }
  }
  actions.resources.updateAsset(
    assetUid,
    {advanced_features: features},
    {
      onComplete: processingActions.activateAsset.completed,
      onFail: processingActions.activateAsset.failed,
    }
  )
})

processingActions.getProcessingData.listen((
  assetUid: string,
  submissionUuid: string
) => {
  const processingUrl = getAssetProcessingUrl(assetUid)
  if (processingUrl === undefined) {
    processingActions.getProcessingData.failed(NO_FEATURE_ERROR)
  } else {
    const xhr = $.ajax({
      dataType: 'json',
      contentType: 'application/json',
      method: 'GET',
      url: processingUrl,
      data: {submission: submissionUuid}
    })
      .done((response: ProcessingDataResponse) => {
        processingActions.getProcessingData.completed(response)
      })
      .fail(processingActions.getProcessingData.failed)

    processingActions.getProcessingData.started(xhr.abort)
  }
})
processingActions.getProcessingData.failed.listen(() => {
  notify(t('Failed to get processing data.'), 'error')
})

processingActions.setTranscript.listen((
  assetUid: string,
  questionName: string,
  submissionUuid: string,
  languageCode: string,
  value: string
) => {
  const processingUrl = getAssetProcessingUrl(assetUid)
  if (processingUrl === undefined) {
    processingActions.setTranscript.failed(NO_FEATURE_ERROR)
  } else {
    const data: TranscriptRequest = {
      submission: submissionUuid
    }
    data[questionName] = {
      transcript: {
        value: value,
        languageCode: languageCode
      }
    }

    $.ajax({
      dataType: 'json',
      contentType: 'application/json',
      method: 'POST',
      url: processingUrl,
      data: JSON.stringify(data)
    })
      .done((response: ProcessingDataResponse) => {
        processingActions.setTranscript.completed(response)
      })
      .fail(processingActions.setTranscript.failed)
  }
})
processingActions.setTranscript.failed.listen(() => {
  notify(t('Failed to set transcript.'), 'error')
})

processingActions.deleteTranscript.listen((
  assetUid: string,
  languageCode: string
) => {
  const processingUrl = getAssetProcessingUrl(assetUid)
  if (processingUrl === undefined) {
    processingActions.deleteTranscript.failed(NO_FEATURE_ERROR)
  } else {
    $.ajax({
      dataType: 'json',
      contentType: 'application/json',
      method: 'DELETE',
      url: processingUrl,
      data: {
        languageCode: languageCode,
      }
    })
      .done(processingActions.deleteTranscript.completed)
      .fail(processingActions.deleteTranscript.failed)
  }
})
processingActions.deleteTranscript.failed.listen(() => {
  notify(t('Failed to delete transcript.'), 'error')
})

// TODO: add a chain-call that would update asset (if needed) to add language code
// to advanced_features.
processingActions.setTranslation.listen((
  assetUid: string,
  questionName: string,
  submissionUuid: string,
  languageCode: string,
  value: string
) => {

  // TODO:
  // 1. get asset
  // 2. from advanced features get a list of enabled languages
  // 3. if languageCode is not inside the list, make a chain call that updates asset first

  // This ensures that `advanced_features` are enabled for given language before
  // sending translation to avoid rejection.
  setTranslationInnerMethod(
    assetUid,
    questionName,
    submissionUuid,
    languageCode,
    value
  )

  const processingUrl = getAssetProcessingUrl(assetUid)
  if (processingUrl === undefined) {
    processingActions.setTranscript.failed(NO_FEATURE_ERROR)
  } else {
    // Sorry for this object being built in such a lengthy way, but it is needed
    // so for typings.
    const translationsObj: TranslationsRequestObject = {}
    translationsObj[languageCode] = {
      value: value,
      languageCode: languageCode
    }
    const data: TranslationRequest = {
      submission: submissionUuid
    }
    data[questionName] = {
      translated: translationsObj
    }

    $.ajax({
      dataType: 'json',
      contentType: 'application/json',
      method: 'POST',
      url: processingUrl,
      data: JSON.stringify(data)
    })
      .done((response: ProcessingDataResponse) => {
        processingActions.setTranscript.completed(response)
      })
      .fail(processingActions.setTranscript.failed)
  }
})
processingActions.setTranslation.failed.listen(() => {
  notify(t('Failed to set transcript.'), 'error')
})

/** This is the method that is directly updating the processing. */
function setTranslationInnerMethod(
  assetUid: string,
  questionName: string,
  submissionUuid: string,
  languageCode: string,
  value: string
) {
  console.log(
    assetUid,
    questionName,
    submissionUuid,
    languageCode,
    value
  )
}

processingActions.deleteTranslation.listen((
  assetUid: string,
  languageCode: string
) => {
  const processingUrl = getAssetProcessingUrl(assetUid)
  if (processingUrl === undefined) {
    processingActions.deleteTranslation.failed(NO_FEATURE_ERROR)
  } else {
    $.ajax({
      dataType: 'json',
      method: 'POST',
      url: processingUrl,
      data: {
        languageCode: languageCode,
      }
    })
      .done(processingActions.deleteTranslation.completed)
      .fail(processingActions.deleteTranslation.failed)
  }
})
processingActions.deleteTranslation.failed.listen(() => {
  notify(t('Failed to delete translation.'), 'error')
})

export default processingActions
