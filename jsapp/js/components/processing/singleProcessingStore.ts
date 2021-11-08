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

export interface Translation {
  content: string
  languageCode: string
  dateCreated: string
}

interface SingleProcessingStoreData {
  transcript?: Transcript
  translations: Translation[]
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

  getTranslation(languageCode: string | undefined) {
    return this.data.translations.find(
      (translation) => translation.languageCode === languageCode
    )
  }

  getTranslations() {
    return this.data.translations
  }

  onSetTranscriptCompleted(transcript: Transcript | undefined) {
    this.isPending = false
    this.data.transcript = transcript
    this.trigger(this.data)
  }

  onGetTranslationsCompleted(translations: Translation[]) {
    this.isPending = false
    this.data.translations = translations
    this.trigger(this.data)
  }

  setTranscript(newTranscript: Transcript | undefined) {
    this.isPending = true

    // TODO: call backend to store transcript, for now we just wait 3 seconds :P
    setTimeout(this.onSetTranscriptCompleted.bind(this, newTranscript), 3000)

    this.trigger(this.data)
  }

  setTranslation(
    newTranslationLanguageCode: string,
    newTranslation: Translation | undefined
  ) {
    this.isPending = true

    // TODO: call backend to store translation, for now we just wait 3 seconds :P
    setTimeout(() => {
      // we mock this flow:
      // 1. send translation to backend
      // 2. observe call finished
      // 3. fetch all translations
      // 4. replace all translations with new ones
      // (this is needed for translations deletion)
      const newTranslations: Translation[] = []
      // this loop rewrites translations so it delete the given languageCode translation
      // if undefined was passed or adds/replaces existing
      let wasTranslationSet = false
      this.data.translations.forEach((translation) => {
        if (translation.languageCode === newTranslationLanguageCode) {
          if (newTranslation) {
            newTranslations.push(newTranslation)
            wasTranslationSet = true
          }
        } else {
          newTranslations.push(translation)
        }
      })
      // if translation did not exist, then it wasn't replaced in the loop above
      // we need to add it now
      if (!wasTranslationSet && newTranslation) {
        newTranslations.push(newTranslation)
      }

      this.onGetTranslationsCompleted(newTranslations)
    }, 3000)

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
