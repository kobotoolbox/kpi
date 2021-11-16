import Reflux from 'reflux'
import {hashHistory} from 'react-router'
import {Location} from 'history'
import {
  isFormSingleProcessingRoute,
  getSingleProcessingRouteParameters,
} from 'js/router/routerUtils'
import processingActions from 'js/components/processing/processingActions'

export enum SingleProcessingTabs {
  Transcript,
  Translations,
  Coding,
}

export interface Transcript {
  content: string
  languageCode: string
  dateCreated: string
  dateModified: string
}

export interface Translation {
  content: string
  languageCode: string
  dateModified: string
  dateCreated: string
}

/** Transcript or translation draft. */
interface TransDraft {
  content?: string
  languageCode?: string
}

interface SingleProcessingStoreData {
  transcript?: Transcript
  transcriptDraft?: TransDraft
  translations: Translation[]
  translationDraft?: TransDraft
  activeTab: SingleProcessingTabs
}

class SingleProcessingStore extends Reflux.Store {
  /**
   * A method for aborting current XHR fetch request.
   * It doesn't need to be defined upfront, but I'm adding it here for clarity.
   */
  private abortFetchData: Function | undefined
  private previousPath: string | undefined

  // We want to give access to this only through methods.
  private data: SingleProcessingStoreData = {
    translations: [],
    activeTab: SingleProcessingTabs.Transcript
  }
  /**
   * Whether current route data is ready - both opening processing from other
   * location, and switching to different submission.
   */
  public isReady: boolean = false
  /** Marks some backend calls being in progress. */
  public isFetchingData: boolean = false

  init() {
    this.setDefaultData()

    hashHistory.listen(this.onRouteChange.bind(this))
    processingActions.getProcessingData.started.listen(this.onFetchDataStarted.bind(this))
    processingActions.getProcessingData.completed.listen(this.onFetchDataCompleted.bind(this))
    processingActions.getProcessingData.failed.listen(this.onFetchDataFailed.bind(this))

    this.fetchData()
  }

  setDefaultData() {
    this.isReady = false
    this.data = {
      transcript: undefined,
      transcriptDraft: undefined,
      translations: [],
      translationDraft: undefined,
      activeTab: SingleProcessingTabs.Transcript
    }
  }

  onRouteChange(data: Location) {
    const routeParams = getSingleProcessingRouteParameters()

    if (
      this.previousPath !== data.pathname &&
      isFormSingleProcessingRoute(
        routeParams.uid,
        routeParams.questionName,
        routeParams.submissionId,
      )
    ) {
      this.setDefaultData()
      this.fetchData()
    }

    this.previousPath = data.pathname;
  }

  onFetchDataStarted(abort: Function) {
    this.abortFetchData = abort
    this.isFetchingData = true
    this.trigger(this.data)
  }

  onFetchDataCompleted(response: any) {
    this.isReady = true
    this.isFetchingData = false

    this.data.translations = response.translations || []
    this.data.transcript = response.transcript

    this.trigger(this.data)
  }

  onFetchDataFailed() {
    delete this.abortFetchData
    this.isFetchingData = false
    this.trigger(this.data)
  }

  fetchData() {
    if (this.abortFetchData !== undefined) {
      this.abortFetchData()
    }

    const routeParams = getSingleProcessingRouteParameters()
    processingActions.getProcessingData(
      routeParams.uid,
      routeParams.questionName,
      routeParams.submissionId
    )
  }

  onGetInitialData(newData: any) {
    this.isReady = true
    this.isFetchingData = false

    this.data.translations = newData.translations || []
    this.data.transcript = newData.transcript

    this.trigger(this.data)
  }

  getTranscript() {
    return this.data.transcript
  }

  getTranscriptDraft() {
    return this.data.transcriptDraft
  }

  getTranslation(languageCode: string | undefined) {
    return this.data.translations.find(
      (translation) => translation.languageCode === languageCode
    )
  }

  getTranslations() {
    return this.data.translations
  }

  getTranslationDraft() {
    return this.data.translationDraft
  }

  onSetTranscriptCompleted(transcript: Transcript | undefined) {
    this.isFetchingData = false
    this.data.transcript = transcript
    this.trigger(this.data)
  }

  // TODO: make sure we get/store the translations ordered by dateModified
  onGetTranslationsCompleted(translations: Translation[]) {
    this.isFetchingData = false
    this.data.translations = translations
    this.trigger(this.data)
  }

  setTranscript(newTranscript: Transcript | undefined) {
    this.isFetchingData = true

    // TODO: call backend to store transcript, for now we just wait 3 seconds :P
    setTimeout(this.onSetTranscriptCompleted.bind(this, newTranscript), 3000)

    this.trigger(this.data)
  }

  /**
   * This stores the translation on backend. We require both language code and
   * whole translation object to allow deleting translations (by passing
   * `undefined` as data).
   */
  setTranslation(
    newTranslationLanguageCode: string,
    newTranslation: Translation | undefined
  ) {
    this.isFetchingData = true

    if (
      newTranslation !== undefined &&
      newTranslation.languageCode !== newTranslationLanguageCode
    ) {
      throw new Error('New translation language code mismatch!')
    }

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

  setTranscriptDraft(newTranscriptDraft: TransDraft | undefined) {
    this.data.transcriptDraft = newTranscriptDraft
    this.trigger(this.data)
  }

  setTranslationDraft(newTranslationDraft: TransDraft | undefined) {
    this.data.translationDraft = newTranslationDraft
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
