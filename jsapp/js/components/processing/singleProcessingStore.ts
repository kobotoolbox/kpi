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
  /** Being displayed on the left side of the screen during translation editing. */
  source?: string
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
    processingActions.getProcessingData.failed.listen(this.onAnyCallFailed.bind(this))
    processingActions.setTranscript.completed.listen(this.onSetTranscriptCompleted.bind(this))
    processingActions.setTranscript.failed.listen(this.onAnyCallFailed.bind(this))
    processingActions.deleteTranscript.completed.listen(this.onDeleteTranscriptCompleted.bind(this))
    processingActions.deleteTranscript.failed.listen(this.onAnyCallFailed.bind(this))
    processingActions.setTranslation.completed.listen(this.onSetTranslationCompleted.bind(this))
    processingActions.setTranslation.failed.listen(this.onAnyCallFailed.bind(this))
    processingActions.deleteTranslation.completed.listen(this.onDeleteTranslationCompleted.bind(this))
    processingActions.deleteTranslation.failed.listen(this.onAnyCallFailed.bind(this))

    this.fetchData()
  }

  setDefaultData() {
    this.isReady = false
    this.data = {
      transcript: undefined,
      transcriptDraft: undefined,
      translations: [],
      translationDraft: undefined,
      source: undefined,
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

    this.previousPath = data.pathname
  }

  onFetchDataStarted(abort: Function) {
    this.abortFetchData = abort
    this.isFetchingData = true
    this.trigger(this.data)
  }

  onFetchDataCompleted(response: any) {
    delete this.abortFetchData
    this.isReady = true
    this.isFetchingData = false

    this.data.translations = response.translations || []
    this.data.transcript = response.transcript

    this.trigger(this.data)
  }

  onAnyCallFailed() {
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

  onSetTranscriptCompleted(transcript: Transcript) {
    this.isFetchingData = false
    this.data.transcript = transcript
    // discard draft after saving (exit the editor)
    this.data.transcriptDraft = undefined
    this.trigger(this.data)
  }

  onDeleteTranscriptCompleted() {
    this.isFetchingData = false
    this.data.transcript = undefined
    this.trigger(this.data)
  }

  onSetTranslationCompleted(newTranslations: Translation[]) {
    this.isFetchingData = false
    this.data.translations = newTranslations
    // discard draft after saving (exit the editor)
    this.data.translationDraft = undefined
    this.trigger(this.data)
  }

  onDeleteTranslationCompleted(newTranslations: Translation[]) {
    this.isFetchingData = false
    this.data.translations = newTranslations
    this.trigger(this.data)
  }

  // TODO: make sure we get/store the translations ordered by dateModified
  onGetTranslationsCompleted(translations: Translation[]) {
    this.isFetchingData = false
    this.data.translations = translations
    this.trigger(this.data)
  }

  /**
   * Returns a list of selectable language codes.
   * Omits the one currently being edited.
   */
  getSources(): string[] {
    const sources = []

    if (this.data.transcript?.languageCode) {
      sources.push(this.data.transcript?.languageCode)
    }

    this.data.translations.forEach((translation: Translation) => {
      if (translation.languageCode !== this.data.translationDraft?.languageCode) {
        sources.push(translation.languageCode)
      }
    })

    return sources
  }

  /** Sets a new source (stores a `languageCode`). */
  setSource(newSource: string) {
    this.data.source = newSource
    this.trigger(this.data)
  }

  /** Returns whole transcript/translation for selected source. */
  getSourceData(): Transcript | Translation | undefined {
    if (!this.data.source) {
      return undefined
    }

    if (this.data.source === this.data.transcript?.languageCode) {
      return this.data.transcript
    } else {
      const found = this.data.translations.find((translation) =>
        translation.languageCode === this.data.source
      )
      return found
    }
  }

  getTranscript() {
    return this.data.transcript
  }

  setTranscript(newTranscript: Transcript | undefined) {
    this.isFetchingData = true

    if (newTranscript === undefined) {
      processingActions.deleteTranscript()
    } else {
      processingActions.setTranscript(newTranscript.languageCode, newTranscript.content)
    }

    this.trigger(this.data)
  }

  getTranscriptDraft() {
    return this.data.transcriptDraft
  }

  setTranscriptDraft(newTranscriptDraft: TransDraft | undefined) {
    this.data.transcriptDraft = newTranscriptDraft
    this.trigger(this.data)
  }

  getTranslation(languageCode: string | undefined) {
    return this.data.translations.find(
      (translation) => translation.languageCode === languageCode
    )
  }

  getTranslations() {
    return this.data.translations
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

    if (newTranslation === undefined) {
      processingActions.deleteTranslation(newTranslationLanguageCode)
    } else {
      processingActions.setTranslation(
        newTranslation.languageCode,
        newTranslation.content
      )
    }

    this.trigger(this.data)
  }

  getTranslationDraft() {
    return this.data.translationDraft
  }

  setTranslationDraft(newTranslationDraft: TransDraft | undefined) {
    this.data.translationDraft = newTranslationDraft

    // If we clear the draft, we remove the source too.
    if (newTranslationDraft === undefined) {
      this.data.source = undefined
    }

    // We show the source when editing translation or creating a new draft.
    if (newTranslationDraft !== undefined) {
      // We use transcript as source by default.
      this.data.source = this.data.transcript?.languageCode
    }

    this.trigger(this.data)
  }

  activateTab(tab: SingleProcessingTabs) {
    this.data.activeTab = tab

    // When changing tab, discard all drafts and the selected source.
    this.data.transcriptDraft = undefined
    this.data.translationDraft = undefined
    this.data.source = undefined

    this.trigger(this.data)
  }

  getActiveTab() {
    return this.data.activeTab
  }

  hasUnsavedTranscriptDraftContent() {
    const draft = this.getTranscriptDraft()
    return (
      draft !== undefined &&
      draft.content !== undefined &&
      draft.content !== this.getTranscript()?.content
    )
  }

  hasUnsavedTranslationDraftContent() {
    const draft = this.getTranslationDraft()
    return (
      draft !== undefined &&
      draft.content !== undefined &&
      draft.content !== this.getTranslation(draft?.languageCode)?.content
    )
  }

  hasAnyUnsavedWork() {
    return (
      this.hasUnsavedTranscriptDraftContent() ||
      this.hasUnsavedTranslationDraftContent()
    )
  }
}

/** Handles content state and data for editors */
const singleProcessingStore = new SingleProcessingStore()
singleProcessingStore.init()

export default singleProcessingStore
