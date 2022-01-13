// TODO
// 1. we need to activate translated language before we create a translation - this will require making one call before the other
// 2. we need to wait for backend to fix response and use the data from translations properly
// 3. handle deleting translations (unactivate language)

import Reflux from 'reflux'
import {notify} from 'alertifyjs'
import {getAssetProcessingUrl} from 'js/assetUtils'

const NO_FEATURE_ERROR = t('Asset seems to not have the processing feature enabled!')

interface TranscriptRequest {
  [questionName: string]: TranscriptRequestQuestion | string | undefined
  submission?: string
}

interface TranscriptRequestQuestion {
  transcript: {
    languageCode: string
    value: string
  }
}

export interface TranscriptResponse {
  [key: string]: TranscriptQuestion
}

interface TranscriptQuestion {
  transcript: {
    dateCreated: string
    dateModified: string
    engine?: string
    languageCode: string
    revisions?: TranscriptRevision[]
    value: string
  }
}

interface TranscriptRevision {
  dateModified: string
  engine?: string
  languageCode: string
  value: string
}

interface TranslationRequest {
  [questionName: string]: TranslationQuestion | string | undefined
  submission?: string
}

interface TranslationQuestion {
  translated: TranslationsObject
}

interface TranslationsObject {
  [languageCode: string]: {
    languageCode: string
    value: string
  }
}

interface ProcessingDataQuestion extends TranscriptQuestion, TranslationQuestion {}

export interface ProcessingDataResponse {
  [key: string]: ProcessingDataQuestion
}

const processingActions = Reflux.createActions({
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
      .done((response: TranscriptResponse) => {
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

processingActions.setTranslation.listen((
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
    // Sorry for this object being built in such a lengthy way, but it is needed
    // so for typings.
    const translationsObj: TranslationsObject = {}
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
      .done((response: TranscriptResponse) => {
        processingActions.setTranscript.completed(response)
      })
      .fail(processingActions.setTranscript.failed)
  }
})
processingActions.setTranslation.failed.listen(() => {
  notify(t('Failed to set transcript.'), 'error')
})

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
