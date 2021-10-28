import Reflux from 'reflux'

export enum SingleProcessingTabs {
  Transcript,
  Translations,
  Coding,
}

export interface Transcript {
  content: string
  languageCode: string
  dateCreated: string
}

export interface TranscriptTranslation {
  content: string
  languageCode: string
  transcriptUrl: string
  dateCreated: string
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

  onSetTranscriptCompleted(transcript: Transcript | undefined) {
    this.isPending = false
    this.data.transcript = transcript
    this.trigger(this.data)
  }

  setTranscript(newTranscript: Transcript | undefined) {
    this.isPending = true

    // TODO: call backend to store transcript, for now we just wait 3 seconds :P
    setTimeout(this.onSetTranscriptCompleted.bind(this, newTranscript), 3000)

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
