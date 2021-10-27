import Reflux from 'reflux'

export enum SingleProcessingTabs {
  Transcript,
  Translations,
  Coding,
}

export interface Transcript {
  content: string
  languageCode: string
}

export interface TranscriptTranslation {
  content: string
  languageCode: string
  transcriptUrl: string
}

interface SingleProcessingStoreData {
  transcript?: Transcript
  translations: TranscriptTranslation[]
  activeTab: SingleProcessingTabs
}

class SingleProcessingStore extends Reflux.Store {
  // We want to give access to this only through methods.
  private data: SingleProcessingStoreData = {
    translations: [],
    activeTab: SingleProcessingTabs.Transcript
  }
  isReady: boolean = false
  /** Marks some backend calls being in progress. */
  isPending: boolean = false

  init() {
    // TODO: see what is required as initial data and make some calls here?
    this.onGetInitialData() // TEMP
  }

  onGetInitialData() {
    this.isReady = true
    this.trigger(this.data)
  }

  getTranscript() {
    return this.data.transcript
  }

  onSetTranscriptCompleted(transcript: Transcript) {
    this.isPending = false
    this.data.transcript = transcript
    this.trigger(this.data)
  }

  setTranscript(newTranscript: Transcript) {
    this.isPending = true

    // TODO: call backend to store transcript
    setTimeout(this.onSetTranscriptCompleted.bind(this, newTranscript), 10000)

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

/** Handles content state and data for editors */
const singleProcessingStore = new SingleProcessingStore()
singleProcessingStore.init()

export default singleProcessingStore
