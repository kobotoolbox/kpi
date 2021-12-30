import Reflux from 'reflux'
import {hashHistory} from 'react-router'
import {Location} from 'history'
import {FORM_PROCESSING_BASE} from 'js/router/routerConstants'
import {
  isFormSingleProcessingRoute,
  getSingleProcessingRouteParameters,
} from 'js/router/routerUtils'
import {
  getAssetProcessingUrl,
  getSurveyFlatPaths,
  getAssetProcessingRows
} from 'js/assetUtils'
import {SurveyFlatPaths} from 'js/assetUtils'
import assetStore from 'js/assetStore'
import {actions} from 'js/actions'
import processingActions, {
  TranscriptResponse,
  ProcessingDataResponse
} from 'js/components/processing/processingActions'

export enum SingleProcessingTabs {
  Transcript,
  Translations,
  Analysis,
}

export interface Transcript {
  value: string
  languageCode: string
  dateCreated: string
  dateModified: string
}

export interface Translation {
  value: string
  languageCode: string
  dateModified: string
  dateCreated: string
}

/** Transcript or translation draft. */
interface TransDraft {
  value?: string
  languageCode?: string
}

/**
 * This contains a list of submissions for every processing-enabled question.
 * In a list: for every submission we store either an `uuid` (when given
 * submission has a response to the question) or a `null` (when given submission
 * doesn't have a response to the question).
 *
 * We use it to navigate through submissions with meaningful data in context of
 * a question.
 *
 * We also use it to navigate through questions - making sure we only allow
 * ones with any meaningful data.
 */
interface SubmissionsUuids {
  [questionName: string]: (string | null)[]
}

interface SingleProcessingStoreData {
  transcript?: Transcript
  transcriptDraft?: TransDraft
  translations: Translation[]
  translationDraft?: TransDraft
  /** Being displayed on the left side of the screen during translation editing. */
  source?: string
  activeTab: SingleProcessingTabs
  submissionData?: SubmissionResponse
  /**
   * A list of all submissions ids, we store `null` for submissions that don't
   * have a response for the question.
   */
  submissionsUuids?: SubmissionsUuids
}

class SingleProcessingStore extends Reflux.Store {
  /**
   * A method for aborting current XHR fetch request.
   * It doesn't need to be defined upfront, but I'm adding it here for clarity.
   */
  private abortFetchData: Function | undefined
  private previousPath: string | undefined
  // For the store to work we need all three: asset, submission, and uuids.
  private isInitialised: boolean = false
  private areUuidsLoaded: boolean = false
  private isSubmissionLoaded: boolean = false
  private isProcessingDataLoaded: boolean = false

  // We want to give access to this only through methods.
  private data: SingleProcessingStoreData = {
    translations: [],
    activeTab: SingleProcessingTabs.Transcript
  }
  /** Marks some backend calls being in progress. */
  public isFetchingData: boolean = false

  init() {
    this.resetProcessingData()

    hashHistory.listen(this.onRouteChange.bind(this))

    actions.submissions.getSubmissionByUuid.completed.listen(this.onGetSubmissionByUuidCompleted.bind(this))
    actions.submissions.getSubmissionByUuid.failed.listen(this.onGetSubmissionByUuidFailed.bind(this))
    actions.submissions.getProcessingSubmissions.completed.listen(this.onGetProcessingSubmissionsCompleted.bind(this))
    actions.submissions.getProcessingSubmissions.failed.listen(this.onGetProcessingSubmissionsFailed.bind(this))

    processingActions.getProcessingData.started.listen(this.onFetchProcessingDataStarted.bind(this))
    processingActions.getProcessingData.completed.listen(this.onFetchProcessingDataCompleted.bind(this))
    processingActions.getProcessingData.failed.listen(this.onAnyCallFailed.bind(this))
    processingActions.setTranscript.completed.listen(this.onSetTranscriptCompleted.bind(this))
    processingActions.setTranscript.failed.listen(this.onAnyCallFailed.bind(this))
    processingActions.deleteTranscript.completed.listen(this.onDeleteTranscriptCompleted.bind(this))
    processingActions.deleteTranscript.failed.listen(this.onAnyCallFailed.bind(this))
    processingActions.setTranslation.completed.listen(this.onSetTranslationCompleted.bind(this))
    processingActions.setTranslation.failed.listen(this.onAnyCallFailed.bind(this))
    processingActions.deleteTranslation.completed.listen(this.onDeleteTranslationCompleted.bind(this))
    processingActions.deleteTranslation.failed.listen(this.onAnyCallFailed.bind(this))

    // We need the asset to be loaded for the store to work (we get the
    // processing endpoint url from asset JSON). We try to startup store
    // immediately and also listen to asset loads.
    this.startupStore()
    actions.resources.loadAsset.completed.listen(this.startupStore.bind(this))
  }

  /**
   * This initialisation is mainly needed because in the case when user loads
   * the processing route URL directly the asset data might not be here yet.
   */
  private startupStore() {
    const routeParams = getSingleProcessingRouteParameters()
    const processingUrl = getAssetProcessingUrl(routeParams.uid)

    if (
      !this.isInitialised &&
      isFormSingleProcessingRoute(
        routeParams.uid,
        routeParams.questionName,
        routeParams.submissionUuid,
      ) &&
      processingUrl !== undefined
    ) {
      this.fetchSubmissionData()
      this.fetchUuids()
      this.fetchProcessingData()
      this.isInitialised = true
    }
  }

  private resetProcessingData() {
    this.isProcessingDataLoaded = false

    this.data.transcript = undefined
    this.data.transcriptDraft = undefined
    this.data.translations = []
    this.data.translationDraft = undefined
    this.data.source = undefined
    this.data.activeTab = SingleProcessingTabs.Transcript
  }

  private onRouteChange(data: Location) {
    if (this.previousPath === data.pathname) {
      return
    }

    const routeParams = getSingleProcessingRouteParameters()

    const baseProcessingRoute = FORM_PROCESSING_BASE.replace(':uid', routeParams.uid)

    // Case 1: switching from a processing route to a processing route.
    // This means that we are changing either the question and the submission
    // or just the submission.
    if (
      this.previousPath !== data.pathname &&
      this.previousPath !== undefined &&
      this.previousPath.startsWith(baseProcessingRoute) &&
      data.pathname.startsWith(baseProcessingRoute)
    ) {
      this.fetchProcessingData()
      this.fetchSubmissionData()
    }

    // Case 2: switching into processing route out of other place (most
    // probably from assets data table route).
    else if (
      this.previousPath !== data.pathname &&
      isFormSingleProcessingRoute(
        routeParams.uid,
        routeParams.questionName,
        routeParams.submissionUuid,
      )
    ) {
      this.fetchProcessingData()
      this.fetchSubmissionData()
      this.fetchUuids()
    }

    this.previousPath = data.pathname
  }

  private fetchSubmissionData(): void {
    this.isSubmissionLoaded = false
    this.data.submissionData = undefined
    this.trigger(this.data)

    const routeParams = getSingleProcessingRouteParameters()
    actions.submissions.getSubmissionByUuid(routeParams.uid, routeParams.submissionUuid)
  }

  private onGetSubmissionByUuidCompleted(response: SubmissionResponse): void {
    this.isSubmissionLoaded = true
    this.data.submissionData = response
    this.trigger(this.data)
  }

  private onGetSubmissionByUuidFailed(): void {
    this.isSubmissionLoaded = true
    this.trigger(this.data)
  }

  /** NOTE: We only need to call this once for given asset. */
  private fetchUuids(): void {
    this.areUuidsLoaded = false
    this.data.submissionsUuids = undefined
    this.trigger(this.data)

    const routeParams = getSingleProcessingRouteParameters()
    const processingRows = getAssetProcessingRows(routeParams.uid)
    const asset = assetStore.getAsset(routeParams.uid)
    let flatPaths: SurveyFlatPaths = {}

    if (asset?.content?.survey) {
      flatPaths = getSurveyFlatPaths(asset.content.survey)
    }

    const processingRowsPaths: string[] = []
    if (processingRows) {
      processingRows.forEach((row) => {
        if (flatPaths[row]) {
          processingRowsPaths.push(flatPaths[row])
        }
      })
    }

    actions.submissions.getProcessingSubmissions(
      routeParams.uid,
      processingRowsPaths
    )
  }

  private onGetProcessingSubmissionsCompleted(response: GetProcessingSubmissionsResponse) {
    const routeParams = getSingleProcessingRouteParameters()
    const submissionsUuids: SubmissionsUuids = {}
    const processingRows = getAssetProcessingRows(routeParams.uid)

    if (processingRows !== undefined) {
      processingRows.forEach((processingRow) => {
        submissionsUuids[processingRow] = []
      })

      response.results.forEach((result) => {
        processingRows.forEach((processingRow) => {
          if (Object.keys(result).includes(processingRow)) {
            submissionsUuids[processingRow].push(result._uuid)
          } else {
            submissionsUuids[processingRow].push(null)
          }
        })
      })
    }

    this.areUuidsLoaded = true
    this.data.submissionsUuids = submissionsUuids
    this.trigger(this.data)
  }

  private onGetProcessingSubmissionsFailed(): void {
    this.areUuidsLoaded = true
    this.trigger(this.data)
  }

  private fetchProcessingData() {
    if (this.abortFetchData !== undefined) {
      this.abortFetchData()
    }

    this.resetProcessingData()

    const routeParams = getSingleProcessingRouteParameters()
    processingActions.getProcessingData(
      routeParams.uid,
      routeParams.submissionUuid
    )
  }

  private onFetchProcessingDataStarted(abort: Function) {
    this.abortFetchData = abort
    this.isFetchingData = true
    this.trigger(this.data)
  }

  private onFetchProcessingDataCompleted(response: ProcessingDataResponse) {
    const routeParams = getSingleProcessingRouteParameters()
    const transcriptResponse = response[routeParams.questionName]?.transcript

    delete this.abortFetchData
    this.isProcessingDataLoaded = true
    this.isFetchingData = false

    this.data.translations = []
    this.data.transcript = transcriptResponse

    this.trigger(this.data)
  }

  private onAnyCallFailed() {
    delete this.abortFetchData
    this.isFetchingData = false
    this.trigger(this.data)
  }

  private onSetTranscriptCompleted(response: TranscriptResponse) {
    const routeParams = getSingleProcessingRouteParameters()
    const transcriptResponse = response[routeParams.questionName]?.transcript

    this.isFetchingData = false

    if (transcriptResponse) {
      this.data.transcript = transcriptResponse
    }
    // discard draft after saving (exit the editor)
    this.data.transcriptDraft = undefined
    this.trigger(this.data)
  }

  private onDeleteTranscriptCompleted() {
    this.isFetchingData = false
    this.data.transcript = undefined
    this.trigger(this.data)
  }

  private onSetTranslationCompleted(newTranslations: Translation[]) {
    this.isFetchingData = false
    this.data.translations = newTranslations
    // discard draft after saving (exit the editor)
    this.data.translationDraft = undefined
    this.trigger(this.data)
  }

  private onDeleteTranslationCompleted(newTranslations: Translation[]) {
    this.isFetchingData = false
    this.data.translations = newTranslations
    this.trigger(this.data)
  }

  // // TODO: make sure we get/store the translations ordered by dateModified
  // private onGetTranslationsCompleted(translations: Translation[]) {
  //   this.isFetchingData = false
  //   this.data.translations = translations
  //   this.trigger(this.data)
  // }

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

  /** Returns a local cached transcript data. */
  getTranscript() {
    return this.data.transcript
  }

  setTranscript(newTranscript: Transcript | undefined) {
    this.isFetchingData = true

    const transcript = this.getTranscript()
    const routeParams = getSingleProcessingRouteParameters()
    if (newTranscript === undefined) {
      processingActions.deleteTranscript(routeParams.uid, transcript?.languageCode)
    } else {
      processingActions.setTranscript(
        routeParams.uid,
        routeParams.questionName,
        routeParams.submissionUuid,
        newTranscript.languageCode,
        newTranscript.value
      )
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

  /** Returns a local cached translation data. */
  getTranslation(languageCode: string | undefined) {
    return this.data.translations.find(
      (translation) => translation.languageCode === languageCode
    )
  }

  /** Returns a local cached translations list. */
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

    const routeParams = getSingleProcessingRouteParameters()

    if (
      newTranslation !== undefined &&
      newTranslation.languageCode !== newTranslationLanguageCode
    ) {
      throw new Error('New translation language code mismatch!')
    }

    if (newTranslation === undefined) {
      processingActions.deleteTranslation(routeParams.uid, newTranslationLanguageCode)
    } else {
      processingActions.setTranslation(
        routeParams.uid,
        newTranslation.languageCode,
        newTranslation.value
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

  getSubmissionData() {
    return this.data.submissionData
  }

  /** NOTE: Returns uuids for current question name, not for all of them. */
  getCurrentQuestionSubmissionsUuids() {
    const routeParams = getSingleProcessingRouteParameters()
    if (this.data.submissionsUuids !== undefined) {
      return this.data.submissionsUuids[routeParams.questionName]
    }
    return undefined
  }

  getSubmissionsUuids() {
    return this.data.submissionsUuids
  }

  getActiveTab() {
    return this.data.activeTab
  }

  hasUnsavedTranscriptDraftValue() {
    const draft = this.getTranscriptDraft()
    return (
      draft !== undefined &&
      draft.value !== undefined &&
      draft.value !== this.getTranscript()?.value
    )
  }

  hasUnsavedTranslationDraftValue() {
    const draft = this.getTranslationDraft()
    return (
      draft !== undefined &&
      draft.value !== undefined &&
      draft.value !== this.getTranslation(draft?.languageCode)?.value
    )
  }

  hasAnyUnsavedWork() {
    return (
      this.hasUnsavedTranscriptDraftValue() ||
      this.hasUnsavedTranslationDraftValue()
    )
  }

  isReady() {
    return (
      this.areUuidsLoaded &&
      this.isSubmissionLoaded &&
      this.isProcessingDataLoaded
    )
  }
}

/** Handles content state and data for editors */
const singleProcessingStore = new SingleProcessingStore()
singleProcessingStore.init()

export default singleProcessingStore
