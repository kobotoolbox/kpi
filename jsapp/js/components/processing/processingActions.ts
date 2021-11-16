import Reflux from 'reflux'

const processingActions = Reflux.createActions({
  getProcessingData: {
    children: [
      'started',
      'completed',
      'failed'
    ]
  }
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

export default processingActions

function getMockData() {
  return {
    transcript: {
      languageCode: 'en',
      content: 'This is some text in English language, please makre sure to translate it correctly or else I will be very much disappointed.',
      dateCreated: 'Mon Nov 8 2021 12:01:16 GMT+0000 (Greenwich Mean Time)',
      dateModified: 'Mon Nov 8 2021 19:00:00 GMT+0000 (Greenwich Mean Time)',
    },
    translations: [
      {
        languageCode: 'pl',
        content: 'To jest tekst w języku angielskim, upewnij się, że przetłumaczysz go poprawnie, w przeciwnym razie będę bardzo rozczarowany.',
        dateCreated: 'Tue Nov 9 2021 14:14:14 GMT+0000 (Greenwich Mean Time)',
        dateModified: 'Wed Nov 9 2021 06:00:00 GMT+0000 (Greenwich Mean Time)'
      },
      {
        languageCode: 'de',
        content: 'Dies ist ein englischer Text, stellen Sie sicher, dass Sie ihn richtig übersetzen, sonst werde ich sehr enttäuscht sein.',
        dateCreated: 'Wed Nov 9 2021 11:01:00 GMT+0000 (Greenwich Mean Time)',
        dateModified: 'Wed Nov 9 2021 11:45:00 GMT+0000 (Greenwich Mean Time)'
      }
    ]
  }
}
