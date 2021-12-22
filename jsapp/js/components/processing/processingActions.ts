import Reflux from 'reflux'
import {notify} from 'alertifyjs'

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
  const xhr = {
    abort: () => {console.log('abort called!', assetUid, questionName, submissionId)}
  }

  window.setTimeout(() => {
    processingActions.getProcessingData.completed(getMockData())
  }, 2000)

  processingActions.getProcessingData.started(xhr.abort)
})
processingActions.getProcessingData.failed.listen(() => {
  notify(t('Failed to get processing data.'), 'error')
})

processingActions.setTranscript.listen((
  languageCode: string,
  value: string
) => {
  // TODO: call backend to store transcript, for now we just wait 3 seconds :P
  window.setTimeout(() => {
    processingActions.setTranscript.completed({
      value: value,
      languageCode: languageCode,
      dateCreated: '2021-11-08T12:01:16.000Z',
      dateModified: '2021-12-01T20:05:20.970Z',
    })
  }, 3000)
})
processingActions.setTranscript.failed.listen(() => {
  notify(t('Failed to set transcript.'), 'error')
})

processingActions.deleteTranscript.listen(() => {
  // TODO: call backend
  window.setTimeout(() => {
    processingActions.deleteTranscript.completed()
  }, 3000)
})
processingActions.deleteTranscript.failed.listen(() => {
  notify(t('Failed to delete transcript.'), 'error')
})

processingActions.setTranslation.listen((
  languageCode: string,
  value: string
) => {
  // TODO: call backend
  window.setTimeout(() => {
    // PRETEND BACKEND
    let wasTranslationSet = false
    memoizedTranslations.forEach((translation) => {
      if (translation.languageCode === languageCode) {
        translation.value = value
        translation.dateModified = '2021-12-01T20:05:20.970Z'
        wasTranslationSet = true
      }
    })
    // if translation did not exist, then it wasn't replaced in the loop above
    // we need to add it now
    if (!wasTranslationSet) {
      memoizedTranslations.push({
        value: value,
        languageCode: languageCode,
        dateCreated: '2021-12-01T20:05:20.970Z',
        dateModified: '2021-12-01T20:05:20.970Z',
      })
    }
    // END PRETEND BACKEND
    processingActions.setTranslation.completed(memoizedTranslations)
  }, 3000)
})
processingActions.setTranslation.failed.listen(() => {
  notify(t('Failed to set translation.'), 'error')
})

processingActions.deleteTranslation.listen((
  languageCode: string
) => {
  // TODO: call backend
  window.setTimeout(() => {
    memoizedTranslations = memoizedTranslations.filter((translation) => translation.languageCode !== languageCode)
    processingActions.deleteTranslation.completed(memoizedTranslations)
  }, 3000)
})
processingActions.deleteTranslation.failed.listen(() => {
  notify(t('Failed to delete translation.'), 'error')
})

export default processingActions



/// MOCKING BELOW

// keeping it just for demo
let memoizedTranslations = getMockData().translations

function getMockData() {
  return {
    transcript: {
      languageCode: 'en',
      value: 'This is some text in English language, please makre sure to translate it correctly or else I will be very much disappointed.',
      dateCreated: '2021-11-08T12:01:16.000Z',
      dateModified: '2021-11-16T23:05:20.970Z',
    },
    translations: [
      {
        languageCode: 'pl',
        value: 'To jest tekst w języku angielskim, upewnij się, że przetłumaczysz go poprawnie, w przeciwnym razie będę bardzo rozczarowany.',
        dateCreated: '2021-11-09T14:14:14.000Z',
        dateModified: '2021-11-10T06:00:00.000Z'
      },
      {
        languageCode: 'de',
        value: 'Dies ist ein englischer Text, stellen Sie sicher, dass Sie ihn richtig übersetzen, sonst werde ich sehr enttäuscht sein.',
        dateCreated: '2021-11-10T11:01:00.000Z',
        dateModified: '2021-11-10T11:45:00.000Z'
      }
    ]
  }
}
