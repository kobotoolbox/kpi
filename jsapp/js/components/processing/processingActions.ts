import Reflux from 'reflux'
import {notify} from 'alertifyjs'
import {getAssetProcessingUrl} from 'js/assetUtils'

const NO_FEATURE_ERROR = t('Asset seems to not have the processing feature enabled!')

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
  questionName: string,
  submissionId: string
) => {
  console.log('processingActionsgetProcessingData', assetUid, questionName, submissionId)

  const processingUrl = getAssetProcessingUrl(assetUid)
  if (processingUrl === undefined) {
    processingActions.getProcessingData.failed(NO_FEATURE_ERROR)
  } else {
    const xhr = $.ajax({
      dataType: 'json',
      method: 'GET',
      url: processingUrl
    })
      .done(processingActions.getProcessingData.completed)
      .fail(processingActions.getProcessingData.failed)

    processingActions.getProcessingData.started(xhr.abort)
  }
})
processingActions.getProcessingData.failed.listen(() => {
  notify(t('Failed to get processing data.'), 'error')
})

processingActions.setTranscript.listen((
  assetUid: string,
  languageCode: string,
  value: string
) => {
  const processingUrl = getAssetProcessingUrl(assetUid)
  if (processingUrl === undefined) {
    processingActions.setTranscript.failed(NO_FEATURE_ERROR)
  } else {
    $.ajax({
      dataType: 'json',
      method: 'POST',
      url: processingUrl,
      data: {
        type: 'transcript',
        value: value,
        languageCode: languageCode,
      }
    })
      .done(processingActions.setTranscript.completed)
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
  languageCode: string,
  value: string
) => {
  const processingUrl = getAssetProcessingUrl(assetUid)
  if (processingUrl === undefined) {
    processingActions.setTranslation.failed(NO_FEATURE_ERROR)
  } else {
    $.ajax({
      dataType: 'json',
      method: 'POST',
      url: processingUrl,
      data: {
        type: 'translation',
        value: value,
        languageCode: languageCode,
      }
    })
      .done(processingActions.setTranslation.completed)
      .fail(processingActions.setTranslation.failed)
  }
})
processingActions.setTranslation.failed.listen(() => {
  notify(t('Failed to set translation.'), 'error')
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
