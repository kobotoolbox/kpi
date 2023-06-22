import Reflux from 'reflux';
import alertify from 'alertifyjs';
import type {RouterState} from '@remix-run/router';
import {FORM_PROCESSING_BASE} from 'js/router/routerConstants';
import {
  isFormSingleProcessingRoute,
  getSingleProcessingRouteParameters,
} from 'js/router/routerUtils';
import {router} from 'js/router/legacy';
import {
  getSurveyFlatPaths,
  getAssetProcessingRows,
  isAssetProcessingActivated,
  getAssetAdvancedFeatures,
  findRowByQpath,
  getRowName,
  getRowNameByQpath,
} from 'js/assetUtils';
import type {SurveyFlatPaths} from 'js/assetUtils';
import assetStore from 'js/assetStore';
import {actions} from 'js/actions';
import processingActions from 'js/components/processing/processingActions';
import type {ProcessingDataResponse} from 'js/components/processing/processingActions';
import type {
  FailResponse,
  SubmissionResponse,
  AssetResponse,
  GetProcessingSubmissionsResponse,
} from 'js/dataInterface';
import type {LanguageCode} from 'js/components/languages/languagesStore';
import type {AnyRowTypeName} from 'js/constants';

export enum SingleProcessingTabs {
  Transcript = 'trc',
  Translations = 'trl',
  Analysis = 'an',
}

/** Shared interface for transcript and translations. */
export interface Transx {
  value: string;
  languageCode: LanguageCode;
  dateCreated: string;
  dateModified: string;
}

/** Transcript or translation draft. */
interface TransxDraft {
  value?: string;
  languageCode?: LanguageCode;
  /** To be used with automatic services. */
  regionCode?: LanguageCode | null;
}

/**
 * This contains a list of submissions for every processing-enabled question.
 * In a list: for every submission we store the `editId` and a `hasResponse`
 * boolean. We use it to navigate through submissions with meaningful data
 * in context of a question. Example:
 *
 * ```
 * {
 *   first_question: [
 *     {editId: 'abc123', hasResponse: true},
 *     {editId: 'asd345', hasResponse: false},
 *   ],
 *   second_question: [
 *     {editId: 'abc123', hasResponse: true},
 *     {editId: 'asd345', hasResponse: true},
 *   ]
 * }
 * ```
 */
interface SubmissionsEditIds {
  [qpath: string]: Array<{
    editId: string;
    hasResponse: boolean;
  }>;
}

interface AutoTranscriptionEvent {
  response: ProcessingDataResponse;
  submissionEditId: string;
}

interface SingleProcessingStoreData {
  transcript?: Transx;
  transcriptDraft?: TransxDraft;
  translations: Transx[];
  translationDraft?: TransxDraft;
  /** Being displayed on the left side of the screen during translation editing. */
  source?: string;
  activeTab: SingleProcessingTabs;
  submissionData?: SubmissionResponse;
  /** A list of all submissions editIds (`meta/rootUuid` or `_uuid`). */
  submissionsEditIds?: SubmissionsEditIds;
}

class SingleProcessingStore extends Reflux.Store {
  /**
   * A method for aborting current XHR fetch request.
   * It doesn't need to be defined upfront, but I'm adding it here for clarity.
   */
  private abortFetchData?: Function;
  private previousPath: string | undefined;
  // For the store to work we need all three: asset, submission, and editIds. The
  // (ability to fetch) processing data is being unlocked by having'em all.
  private areEditIdsLoaded = false;
  private isSubmissionLoaded = false;
  private isProcessingDataLoaded = false;

  // We want to give access to this only through methods.
  private data: SingleProcessingStoreData = {
    translations: [],
    activeTab: SingleProcessingTabs.Transcript,
  };
  /** Marks some backend calls being in progress. */
  public isFetchingData = false;
  public isPollingForTranscript = false;

  private resetProcessingData() {
    this.isProcessingDataLoaded = false;
    this.isPollingForTranscript = false;

    this.data.transcript = undefined;
    this.data.transcriptDraft = undefined;
    this.data.translations = [];
    this.data.translationDraft = undefined;
    this.data.source = undefined;
    this.data.activeTab = SingleProcessingTabs.Transcript;
  }

  public get currentAssetUid(): string {
    return getSingleProcessingRouteParameters().uid;
  }

  public get currentQuestionQpath(): string | undefined {
    return getSingleProcessingRouteParameters().qpath;
  }

  public get currentSubmissionEditId(): string {
    return getSingleProcessingRouteParameters().submissionEditId;
  }

  public get currentQuestionName() {
    const asset = assetStore.getAsset(this.currentAssetUid);
    if (asset?.content && this.currentQuestionQpath) {
      const foundRow = findRowByQpath(asset.content, this.currentQuestionQpath);
      if (foundRow) {
        return getRowName(foundRow);
      }
      return undefined;
    }
    return undefined;
  }

  public get currentQuestionType(): AnyRowTypeName | undefined {
    const asset = assetStore.getAsset(this.currentAssetUid);
    if (asset?.content && this.currentQuestionQpath) {
      const foundRow = findRowByQpath(
        asset?.content,
        this.currentQuestionQpath
      );
      return foundRow?.type;
    }
    return undefined;
  }

  init() {
    this.resetProcessingData();

    setTimeout(() => router!.subscribe(this.onRouteChange.bind(this)));

    actions.submissions.getSubmissionByUuid.completed.listen(
      this.onGetSubmissionByUuidCompleted.bind(this)
    );
    actions.submissions.getSubmissionByUuid.failed.listen(
      this.onGetSubmissionByUuidFailed.bind(this)
    );
    actions.submissions.getProcessingSubmissions.completed.listen(
      this.onGetProcessingSubmissionsCompleted.bind(this)
    );
    actions.submissions.getProcessingSubmissions.failed.listen(
      this.onGetProcessingSubmissionsFailed.bind(this)
    );

    processingActions.getProcessingData.started.listen(
      this.onFetchProcessingDataStarted.bind(this)
    );
    processingActions.getProcessingData.completed.listen(
      this.onFetchProcessingDataCompleted.bind(this)
    );
    processingActions.getProcessingData.failed.listen(
      this.onAnyCallFailed.bind(this)
    );
    processingActions.setTranscript.completed.listen(
      this.onSetTranscriptCompleted.bind(this)
    );
    processingActions.setTranscript.failed.listen(
      this.onAnyCallFailed.bind(this)
    );
    processingActions.deleteTranscript.completed.listen(
      this.onDeleteTranscriptCompleted.bind(this)
    );
    processingActions.deleteTranscript.failed.listen(
      this.onAnyCallFailed.bind(this)
    );
    processingActions.requestAutoTranscription.completed.listen(
      this.onRequestAutoTranscriptionCompleted.bind(this)
    );
    processingActions.requestAutoTranscription.in_progress.listen(
      this.onRequestAutoTranscriptionInProgress.bind(this)
    );
    processingActions.requestAutoTranscription.failed.listen(
      this.onAnyCallFailed.bind(this)
    );
    processingActions.setTranslation.completed.listen(
      this.onSetTranslationCompleted.bind(this)
    );
    processingActions.setTranslation.failed.listen(
      this.onAnyCallFailed.bind(this)
    );
    // NOTE: deleteTranslation endpoint is sending whole processing data in response.
    processingActions.deleteTranslation.completed.listen(
      this.onFetchProcessingDataCompleted.bind(this)
    );
    processingActions.deleteTranslation.failed.listen(
      this.onAnyCallFailed.bind(this)
    );
    processingActions.requestAutoTranslation.completed.listen(
      this.onRequestAutoTranslationCompleted.bind(this)
    );
    processingActions.requestAutoTranslation.failed.listen(
      this.onAnyCallFailed.bind(this)
    );
    processingActions.activateAsset.completed.listen(
      this.onActivateAssetCompleted.bind(this)
    );

    // We need the asset to be loaded for the store to work (we get the
    // processing endpoint url from asset JSON). We try to startup store
    // immediately and also listen to asset loads.
    this.startupStore();
  }

  /** This is making sure the asset processing features are activated. */
  onAssetLoad(asset: AssetResponse) {
    if (
      this.currentQuestionQpath &&
      isFormSingleProcessingRoute(
        this.currentAssetUid,
        this.currentQuestionQpath,
        this.currentSubmissionEditId
      ) &&
      this.currentAssetUid === asset.uid
    ) {
      if (!isAssetProcessingActivated(this.currentAssetUid)) {
        this.activateAsset();
      } else {
        this.fetchAllInitialDataForAsset();
      }
    }
  }

  onActivateAssetCompleted() {
    this.fetchAllInitialDataForAsset();
  }

  activateAsset() {
    processingActions.activateAsset(this.currentAssetUid, true, []);
  }

  /**
   * This initialisation is mainly needed because in the case when user loads
   * the processing route URL directly the asset data might not be here yet.
   */
  private startupStore() {
    if (
      this.currentQuestionQpath &&
      isFormSingleProcessingRoute(
        this.currentAssetUid,
        this.currentQuestionQpath,
        this.currentSubmissionEditId
      )
    ) {
      const isAssetLoaded = Boolean(assetStore.getAsset(this.currentAssetUid));
      if (isAssetLoaded) {
        this.fetchAllInitialDataForAsset();
      } else {
        // This would happen when user is opening the processing URL directly,
        // thus asset might not be loaded yet. We need to wait for it and try
        // starting up again (through `onAssetLoad`).
        assetStore.whenLoaded(
          this.currentAssetUid,
          this.onAssetLoad.bind(this)
        );
      }
    }
  }

  /**
   * This does a few things:
   * 1. checks if asset is processing-activated and activates if not
   * 2. fetches all data needed when processing view is opened (in comparison to
   *    fetching data needed when switching processing question or submission)
   */
  private fetchAllInitialDataForAsset() {
    // JUST A NOTE: we don't need to load asset ourselves, as it is already
    // taken care of in `PermProtectedRoute`. It can happen so that this method
    // is being called sooner than the mentioned component does its thing.
    const isAssetLoaded = Boolean(assetStore.getAsset(this.currentAssetUid));

    // Without asset we can't do anything yet.
    if (!isAssetLoaded) {
      return;
    }

    if (!isAssetProcessingActivated(this.currentAssetUid)) {
      this.activateAsset();
    } else {
      this.fetchSubmissionData();
      this.fetchEditIds();
      this.fetchProcessingData();
    }
  }

  private onRouteChange(data: RouterState) {
    if (this.previousPath === data.location.pathname) {
      return;
    }

    const baseProcessingRoute = FORM_PROCESSING_BASE.replace(
      ':uid',
      this.currentAssetUid
    );

    // Case 1: switching from a processing route to a processing route.
    // This means that we are changing either the question and the submission
    // or just the submission.
    if (
      this.previousPath !== data.location.pathname &&
      this.previousPath !== undefined &&
      this.previousPath.startsWith(baseProcessingRoute) &&
      data.location.pathname.startsWith(baseProcessingRoute)
    ) {
      this.fetchProcessingData();
      this.fetchSubmissionData();
    } else if (
      // Case 2: switching into processing route out of other place (most
      // probably from assets data table route).
      this.previousPath !== data.location.pathname &&
      this.currentQuestionQpath &&
      isFormSingleProcessingRoute(
        this.currentAssetUid,
        this.currentQuestionQpath,
        this.currentSubmissionEditId
      )
    ) {
      this.fetchAllInitialDataForAsset();
    }

    this.previousPath = data.location.pathname;
  }

  private fetchSubmissionData(): void {
    this.isSubmissionLoaded = false;
    this.data.submissionData = undefined;
    this.trigger(this.data);

    actions.submissions.getSubmissionByUuid(
      this.currentAssetUid,
      this.currentSubmissionEditId
    );
  }

  private onGetSubmissionByUuidCompleted(response: SubmissionResponse): void {
    this.isSubmissionLoaded = true;
    this.data.submissionData = response;
    this.trigger(this.data);
  }

  private onGetSubmissionByUuidFailed(): void {
    this.isSubmissionLoaded = true;
    this.trigger(this.data);
  }

  /**
   * NOTE: We only need to call this once for given asset. We assume that while
   * processing view is opened, submissions will not be deleted or added.
   */
  private fetchEditIds(): void {
    this.areEditIdsLoaded = false;
    this.data.submissionsEditIds = undefined;
    this.trigger(this.data);

    const processingRows = getAssetProcessingRows(this.currentAssetUid);
    const asset = assetStore.getAsset(this.currentAssetUid);
    let flatPaths: SurveyFlatPaths = {};

    // We need to get a regular path (not qpath!) for each of the processing
    // rows. In theory we could just convert the qpath strings, but it's safer
    // to use the asset data that we already have.
    const processingRowsPaths: string[] = [];

    if (asset?.content?.survey) {
      flatPaths = getSurveyFlatPaths(asset.content.survey);

      if (processingRows) {
        processingRows.forEach((qpath) => {
          if (asset?.content) {
            // Here we need to "convert" qpath into name, as flatPaths work with
            // names only. We search the row by qpath and use its name.
            const rowName = getRowNameByQpath(asset.content, qpath);

            if (rowName && flatPaths[rowName]) {
              processingRowsPaths.push(flatPaths[rowName]);
            }
          }
        });
      }
    }

    actions.submissions.getProcessingSubmissions(
      this.currentAssetUid,
      processingRowsPaths
    );
  }

  private onGetProcessingSubmissionsCompleted(
    response: GetProcessingSubmissionsResponse
  ) {
    const submissionsEditIds: SubmissionsEditIds = {};
    const processingRows = getAssetProcessingRows(this.currentAssetUid);

    const asset = assetStore.getAsset(this.currentAssetUid);
    let flatPaths: SurveyFlatPaths = {};

    if (asset?.content?.survey) {
      flatPaths = getSurveyFlatPaths(asset.content.survey);

      if (processingRows !== undefined) {
        processingRows.forEach((qpath) => {
          submissionsEditIds[qpath] = [];
        });

        response.results.forEach((result) => {
          processingRows.forEach((qpath) => {
            if (asset?.content) {
              // Here we need to "convert" qpath into name, as flatPaths work with
              // names only. We search the row by qpath and use its name.
              const rowName = getRowNameByQpath(asset.content, qpath);

              if (rowName) {
                // `meta/rootUuid` is persistent across edits while `_uuid` is not;
                // use the persistent identifier if present.
                let uuid = result['meta/rootUuid'];
                if (uuid === undefined) {
                  uuid = result['_uuid'];
                }
                submissionsEditIds[qpath].push({
                  editId: uuid,
                  hasResponse: Object.keys(result).includes(flatPaths[rowName]),
                });
              }
            }
          });
        });
      }
    }

    this.areEditIdsLoaded = true;
    this.data.submissionsEditIds = submissionsEditIds;
    this.trigger(this.data);
  }

  private onGetProcessingSubmissionsFailed(): void {
    this.areEditIdsLoaded = true;
    this.trigger(this.data);
  }

  private fetchProcessingData() {
    if (this.abortFetchData !== undefined) {
      this.abortFetchData();
    }

    this.resetProcessingData();

    processingActions.getProcessingData(
      this.currentAssetUid,
      this.currentSubmissionEditId
    );
  }

  private onFetchProcessingDataStarted(abort: () => void) {
    this.abortFetchData = abort;
    this.isFetchingData = true;
    this.trigger(this.data);
  }

  private onFetchProcessingDataCompleted(response: ProcessingDataResponse) {
    if (!this.currentQuestionQpath) {
      return;
    }

    const transcriptResponse = response[this.currentQuestionQpath]?.transcript;
    // NOTE: we treat empty transcript object same as nonexistent one
    this.data.transcript = undefined;
    if (transcriptResponse?.value && transcriptResponse?.languageCode) {
      this.data.transcript = transcriptResponse;
    }

    const translationsResponse =
      response[this.currentQuestionQpath]?.translation;
    const translationsArray: Transx[] = [];
    if (translationsResponse) {
      Object.keys(translationsResponse).forEach(
        (languageCode: LanguageCode) => {
          const translation = translationsResponse[languageCode];
          if (translation.languageCode) {
            translationsArray.push({
              value: translation.value,
              languageCode: translation.languageCode,
              dateModified: translation.dateModified,
              dateCreated: translation.dateCreated,
            });
          }
        }
      );
    }
    this.data.translations = translationsArray;

    delete this.abortFetchData;
    this.isProcessingDataLoaded = true;
    this.isFetchingData = false;

    this.trigger(this.data);
  }

  /**
   * Additionally to regular API failure response, we also handle a case when
   * the call was aborted due to features not being enabled. In such case we get
   * a simple string instead of response object.
   */
  private onAnyCallFailed(response: FailResponse | string) {
    let errorText = t('Something went wrong');
    if (typeof response === 'string') {
      errorText = response;
    } else {
      errorText =
        response.responseJSON?.detail ||
        response.responseJSON?.error ||
        response.statusText;
    }
    alertify.notify(errorText, 'error');
    delete this.abortFetchData;
    this.isFetchingData = false;
    this.isPollingForTranscript = false;
    this.trigger(this.data);
  }

  private onSetTranscriptCompleted(response: ProcessingDataResponse) {
    if (!this.currentQuestionQpath) {
      return;
    }

    const transcriptResponse = response[this.currentQuestionQpath]?.transcript;

    this.isFetchingData = false;

    if (transcriptResponse) {
      this.data.transcript = transcriptResponse;
    }
    // discard draft after saving (exit the editor)
    this.data.transcriptDraft = undefined;
    this.trigger(this.data);
  }

  private onDeleteTranscriptCompleted() {
    this.isFetchingData = false;
    this.data.transcript = undefined;
    this.trigger(this.data);
  }

  private isAutoTranscriptionEventApplicable(event: AutoTranscriptionEvent) {
    // previously initiated automatic transcriptions may no longer be
    // applicable to the current route
    if (!this.currentQuestionQpath) {
      return false;
    }
    const googleTsResponse =
      event.response[this.currentQuestionQpath]?.googlets;
    return (
      event.submissionEditId === this.currentSubmissionEditId &&
      googleTsResponse &&
      this.data.transcriptDraft &&
      (googleTsResponse.languageCode ===
        this.data.transcriptDraft.languageCode ||
        googleTsResponse.languageCode === this.data.transcriptDraft.regionCode)
    );
  }

  private onRequestAutoTranscriptionCompleted(event: AutoTranscriptionEvent) {
    if (
      !this.currentQuestionQpath ||
      !this.isPollingForTranscript ||
      !this.data.transcriptDraft
    ) {
      return;
    }
    const googleTsResponse =
      event.response[this.currentQuestionQpath]?.googlets;
    if (googleTsResponse && this.isAutoTranscriptionEventApplicable(event)) {
      this.isPollingForTranscript = false;
      this.data.transcriptDraft.value = googleTsResponse.value;
    }
    this.trigger(this.data);
  }

  private onRequestAutoTranscriptionInProgress(event: AutoTranscriptionEvent) {
    setTimeout(() => {
      // make sure to check for applicability *after* the timeout fires, not
      // before. someone can do a lot of navigating in 5 seconds
      if (this.isAutoTranscriptionEventApplicable(event)) {
        this.isPollingForTranscript = true;
        this.requestAutoTranscription();
      } else {
        this.isPollingForTranscript = false;
      }
    }, 5000);
  }

  private onSetTranslationCompleted(newTranslations: Transx[]) {
    this.isFetchingData = false;
    this.data.translations = newTranslations;
    // discard draft after saving (exit the editor)
    this.data.translationDraft = undefined;
    this.data.source = undefined;
    this.trigger(this.data);
  }

  private onRequestAutoTranslationCompleted(response: ProcessingDataResponse) {
    if (!this.currentQuestionQpath) {
      return;
    }

    const googleTxResponse = response[this.currentQuestionQpath]?.googletx;

    this.isFetchingData = false;
    if (
      googleTxResponse &&
      this.data.translationDraft &&
      (googleTxResponse.languageCode ===
        this.data.translationDraft.languageCode ||
        googleTxResponse.languageCode === this.data.translationDraft.regionCode)
    ) {
      this.data.translationDraft.value = googleTxResponse.value;
    }
    this.trigger(this.data);
  }

  /**
   * Returns a list of selectable language codes.
   * Omits the one currently being edited.
   */
  getSources(): string[] {
    const sources = [];

    if (this.data.transcript?.languageCode) {
      sources.push(this.data.transcript?.languageCode);
    }

    this.data.translations.forEach((translation: Transx) => {
      if (
        translation.languageCode !== this.data.translationDraft?.languageCode
      ) {
        sources.push(translation.languageCode);
      }
    });

    return sources;
  }

  setSource(languageCode: LanguageCode) {
    this.data.source = languageCode;
    this.trigger(this.data);
  }

  /** Returns whole transcript/translation for selected source. */
  getSourceData(): Transx | undefined {
    if (!this.data.source) {
      return undefined;
    }

    if (this.data.source === this.data.transcript?.languageCode) {
      return this.data.transcript;
    } else {
      const found = this.data.translations.find(
        (translation) => translation.languageCode === this.data.source
      );
      return found;
    }
  }

  /** Returns a local cached transcript data. */
  getTranscript() {
    return this.data.transcript;
  }

  setTranscript(languageCode: LanguageCode, value: string) {
    if (!this.currentQuestionQpath) {
      return;
    }

    this.isFetchingData = true;
    processingActions.setTranscript(
      this.currentAssetUid,
      this.currentQuestionQpath,
      this.currentSubmissionEditId,
      languageCode,
      value
    );
    this.trigger(this.data);
  }

  deleteTranscript() {
    if (!this.currentQuestionQpath) {
      return;
    }

    this.isFetchingData = true;
    processingActions.deleteTranscript(
      this.currentAssetUid,
      this.currentQuestionQpath,
      this.currentSubmissionEditId
    );
    this.trigger(this.data);
  }

  requestAutoTranscription() {
    if (!this.currentQuestionQpath) {
      return;
    }

    this.isPollingForTranscript = true;
    processingActions.requestAutoTranscription(
      this.currentAssetUid,
      this.currentQuestionQpath,
      this.currentSubmissionEditId,
      this.data.transcriptDraft?.languageCode,
      this.data.transcriptDraft?.regionCode
    );
    this.trigger(this.data);
  }

  getTranscriptDraft() {
    return this.data.transcriptDraft;
  }

  setTranscriptDraft(newTranscriptDraft: TransxDraft) {
    this.data.transcriptDraft = newTranscriptDraft;
    this.trigger(this.data);
  }

  deleteTranscriptDraft() {
    this.data.transcriptDraft = undefined;
    this.trigger(this.data);
  }

  /**
   * Returns a list of language codes of languages that are activated within
   * advanced_features.transcript, i.e. languages that were already used for
   * transcripts with other submissions in this project.
   */
  getAssetTranscriptableLanguages() {
    const advancedFeatures = getAssetAdvancedFeatures(this.currentAssetUid);
    if (advancedFeatures?.transcript?.languages) {
      return advancedFeatures.transcript.languages;
    }
    return [];
  }

  /** Returns a local cached translation data. */
  getTranslation(languageCode: LanguageCode | undefined) {
    return this.data.translations.find(
      (translation) => translation.languageCode === languageCode
    );
  }

  /** Returns a local cached translations list. */
  getTranslations() {
    return this.data.translations;
  }

  /** This stores the translation on backend. */
  setTranslation(languageCode: LanguageCode, value: string) {
    if (!this.currentQuestionQpath) {
      return;
    }

    this.isFetchingData = true;
    processingActions.setTranslation(
      this.currentAssetUid,
      this.currentQuestionQpath,
      this.currentSubmissionEditId,
      languageCode,
      value
    );
    this.trigger(this.data);
  }

  deleteTranslation(languageCode: LanguageCode) {
    if (!this.currentQuestionQpath) {
      return;
    }

    this.isFetchingData = true;
    processingActions.deleteTranslation(
      this.currentAssetUid,
      this.currentQuestionQpath,
      this.currentSubmissionEditId,
      languageCode
    );
    this.trigger(this.data);
  }

  requestAutoTranslation(languageCode: string) {
    if (!this.currentQuestionQpath) {
      return;
    }

    this.isFetchingData = true;
    processingActions.requestAutoTranslation(
      this.currentAssetUid,
      this.currentQuestionQpath,
      this.currentSubmissionEditId,
      languageCode
    );
    this.trigger(this.data);
  }

  getTranslationDraft() {
    return this.data.translationDraft;
  }

  setTranslationDraft(newTranslationDraft: TransxDraft) {
    this.data.translationDraft = newTranslationDraft;
    // We use transcript as source by default.
    if (this.data.source === undefined) {
      this.data.source = this.data.transcript?.languageCode;
    }
    this.trigger(this.data);
  }

  deleteTranslationDraft() {
    this.data.translationDraft = undefined;
    // If we clear the draft, we remove the source too.
    this.data.source = undefined;
    this.trigger(this.data);
  }

  /**
   * Returns a list of language codes of languages that are activated within
   * advanced_features.translated
   */
  getAssetTranslatableLanguages() {
    const advancedFeatures = getAssetAdvancedFeatures(this.currentAssetUid);
    if (advancedFeatures?.translation?.languages) {
      return advancedFeatures.translation.languages;
    }
    return [];
  }

  activateTab(tab: SingleProcessingTabs) {
    this.data.activeTab = tab;

    // When changing tab, discard all drafts and the selected source.
    this.data.transcriptDraft = undefined;
    this.data.translationDraft = undefined;
    this.data.source = undefined;

    this.trigger(this.data);
  }

  getSubmissionData() {
    return this.data.submissionData;
  }

  /** NOTE: Returns editIds for current question name, not for all of them. */
  getCurrentQuestionSubmissionsEditIds() {
    if (
      this.currentQuestionQpath &&
      this.data.submissionsEditIds !== undefined
    ) {
      return this.data.submissionsEditIds[this.currentQuestionQpath];
    }
    return undefined;
  }

  getSubmissionsEditIds() {
    return this.data.submissionsEditIds;
  }

  getActiveTab() {
    return this.data.activeTab;
  }

  hasUnsavedTranscriptDraftValue() {
    const draft = this.getTranscriptDraft();
    return (
      draft?.value !== undefined && draft.value !== this.getTranscript()?.value
    );
  }

  hasUnsavedTranslationDraftValue() {
    const draft = this.getTranslationDraft();
    return (
      draft?.value !== undefined &&
      draft.value !== this.getTranslation(draft?.languageCode)?.value
    );
  }

  hasAnyUnsavedWork() {
    return (
      this.hasUnsavedTranscriptDraftValue() ||
      this.hasUnsavedTranslationDraftValue()
    );
  }

  isReady() {
    return (
      isAssetProcessingActivated(this.currentAssetUid) &&
      this.areEditIdsLoaded &&
      this.isSubmissionLoaded &&
      this.isProcessingDataLoaded
    );
  }
}

/**
 * Stores all data necessary for rendering the single processing route and all
 * its features. Handles draft transcripts/translations, switching content tabs.
 */
const singleProcessingStore = new SingleProcessingStore();
singleProcessingStore.init();

export default singleProcessingStore;
