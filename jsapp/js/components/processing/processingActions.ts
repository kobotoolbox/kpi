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
      dateCreated: '2021-11-8T12:01:16.000Z',
      dateModified: '2021-11-16T23:05:20.970Z',
    },
    translations: [
      {
        languageCode: 'pl',
        content: 'To jest tekst w języku angielskim, upewnij się, że przetłumaczysz go poprawnie, w przeciwnym razie będę bardzo rozczarowany.',
        dateCreated: '2021-11-9T14:14:14.000Z',
        dateModified: '2021-11-10T06:00:00.000Z'
      },
      {
        languageCode: 'de',
        content: 'Dies ist ein englischer Text, stellen Sie sicher, dass Sie ihn richtig übersetzen, sonst werde ich sehr enttäuscht sein.',
        dateCreated: '2021-11-10T11:01:00.000Z',
        dateModified: '2021-11-10T11:45:00.000Z'
      }
    ]
  }
}
