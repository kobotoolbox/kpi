import Reflux from 'reflux'

export enum SingleProcessingTabs {
  Transcript,
  Translations,
  Coding,
}

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
  activeTab: SingleProcessingTabs
}

class SingleProcessingStore extends Reflux.Store {
  data: SingleProcessingStoreData = {
    translations: [],
    activeTab: SingleProcessingTabs.Transcript
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

  activateTab(tab: SingleProcessingTabs) {
    this.data.activeTab = tab
    this.trigger(this.data)
  }

  getActiveTab() {
    return this.data.activeTab
  }
}

const singleProcessingStore = new SingleProcessingStore();
singleProcessingStore.init();

export default singleProcessingStore;
