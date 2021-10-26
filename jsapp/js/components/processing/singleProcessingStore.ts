import Reflux from 'reflux'

export interface TranscriptText {
  content: string
  languageCode: string
}

export interface TranscriptTranslation {
  content: string
  languageCode: string
  transcriptUrl: string
}

interface SingleProcessingStoreData {
  transcript?: TranscriptText
  translations: TranscriptTranslation[]
}

class SingleProcessingStore extends Reflux.Store {
  data: SingleProcessingStoreData = {
    translations: []
  }

  isReady: boolean = false

  init() {
    // TODO: see what is required as initial data and make some calls here?
    this.onGetInitialData() // TEMP
  }

  onGetInitialData() {
    this.isReady = true
    this.trigger(this.data)
  }
}

const singleProcessingStore = new SingleProcessingStore();
singleProcessingStore.init();

export default singleProcessingStore;
