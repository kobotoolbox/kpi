import Reflux from 'reflux';
import alertify from 'alertifyjs';
import type {RouterState} from '@remix-run/router';
import {router} from 'js/router/legacy';
import {getCurrentPath} from 'js/router/routerUtils';
import {
  getSurveyFlatPaths,
  getAssetProcessingRows,
  isAssetProcessingActivated,
  getAssetAdvancedFeatures,
  findRowByXpath,
  getRowName,
  getRowNameByXpath,
  getFlatQuestionsList,
  getLanguageIndex,
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
import {QUESTION_TYPES, type AnyRowTypeName, XML_VALUES_OPTION_VALUE} from 'js/constants';
import {destroyConfirm} from 'js/alertify';
import {
  isAnyProcessingRoute,
  isAnyProcessingRouteActive,
  getProcessingRouteParts,
  getCurrentProcessingRouteParts,
  ProcessingTab,
} from 'js/components/processing/routes.utils';
import type {KoboSelectOption} from 'js/components/common/koboSelect';
import {getExponentialDelayTime} from 'jsapp/js/utils';
import envStore from 'jsapp/js/envStore';

export enum StaticDisplays {
  Data = 'Data',
  Audio = 'Audio',
  Transcript = 'Transcript',
}

export type DisplaysList = Array<LanguageCode | StaticDisplays>;

type SidebarDisplays = {
  [tabName in ProcessingTab]: DisplaysList;
};

export const DefaultDisplays: Map<ProcessingTab, DisplaysList> = new Map([
  [ProcessingTab.Transcript, [StaticDisplays.Audio, StaticDisplays.Data]],
  [
    ProcessingTab.Translations,
    [StaticDisplays.Audio, StaticDisplays.Data, StaticDisplays.Transcript],
  ],
  [
    ProcessingTab.Analysis,
    [StaticDisplays.Audio, StaticDisplays.Data, StaticDisplays.Transcript],
  ],
]);

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
  [xpath: string]: Array<{
    editId: string;
    hasResponse: boolean;
  }>;
}

interface AutoTransxEvent {
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
  submissionData?: SubmissionResponse;
  /** A list of all submissions editIds (`meta/rootUuid` or `_uuid`). */
  submissionsEditIds?: SubmissionsEditIds;
  /**
   * Whether any changes were made to the data by user after Single Processing
   * View was opened (only changes saved to Back end are taken into account).
   */
  isPristine: boolean;
  /** Marks some backend calls being in progress. */
  isFetchingData: boolean;
  isPollingForTranscript: boolean;
  isPollingForTranslation: boolean;
  hiddenSidebarQuestions: string[];
  currentlyDisplayedLanguage: LanguageCode | string;
  exponentialBackoffCount: number;
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

  /**
   * A list of active sidebar displays for each of the tabs. They start off with
   * some default values for each tab, and can be configured through Display
   * Settings and remembered for as long as the Processing View is being opened.
   */
  private displays = this.getInitialDisplays();

  private analysisTabHasUnsavedWork = false;

  public data: SingleProcessingStoreData = {
    translations: [],
    isPristine: true,
    isFetchingData: false,
    isPollingForTranscript: false,
    isPollingForTranslation: false,
    hiddenSidebarQuestions: [],
    currentlyDisplayedLanguage: this.getInitialDisplayedLanguage(),
    exponentialBackoffCount: 1,
  };

  /** Clears all data - useful before making initialisation call */
  private resetProcessingData() {
    this.isProcessingDataLoaded = false;
    this.data.isPollingForTranscript = false;
    this.data.isPollingForTranslation = false;
    this.data.transcript = undefined;
    this.data.transcriptDraft = undefined;
    this.data.translations = [];
    this.data.translationDraft = undefined;
    this.data.source = undefined;
    this.data.isPristine = true;
    this.data.currentlyDisplayedLanguage = this.getInitialDisplayedLanguage();
    this.data.exponentialBackoffCount = 1;
  }

  public get currentAssetUid() {
    return getCurrentProcessingRouteParts().assetUid;
  }

  public get currentQuestionXpath() {
    return getCurrentProcessingRouteParts().xpath;
  }

  public get currentSubmissionEditId() {
    return getCurrentProcessingRouteParts().submissionEditId;
  }

  public get currentQuestionName() {
    const asset = assetStore.getAsset(this.currentAssetUid);
    if (asset?.content) {
      const foundRow = findRowByXpath(asset.content, this.currentQuestionXpath);
      if (foundRow) {
        return getRowName(foundRow);
      }
      return undefined;
    }
    return undefined;
  }

  public get currentQuestionType(): AnyRowTypeName | undefined {
    const asset = assetStore.getAsset(this.currentAssetUid);
    if (asset?.content) {
      const foundRow = findRowByXpath(
        asset?.content,
        this.currentQuestionXpath
      );
      return foundRow?.type;
    }
    return undefined;
  }

  init() {
    this.resetProcessingData();

    // We start off with noting down current path if there is none (i.e. case
    // of opening processing directly from URL)
    if (!this.previousPath) {
      this.previousPath = getCurrentPath();
    }

    // HACK: We add this ugly `setTimeout` to ensure router exists.
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
    processingActions.requestAutoTranslation.in_progress.listen(
      this.onRequestAutoTranslationInProgress.bind(this)
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
  private onAssetLoad(asset: AssetResponse) {
    if (isAnyProcessingRouteActive() && this.currentAssetUid === asset.uid) {
      if (!isAssetProcessingActivated(this.currentAssetUid)) {
        this.activateAsset();
      } else {
        this.fetchAllInitialDataForAsset();
      }
    }
  }

  private onActivateAssetCompleted() {
    this.fetchAllInitialDataForAsset();
  }

  private activateAsset() {
    processingActions.activateAsset(this.currentAssetUid, true, []);
  }

  /**
   * This initialisation is mainly needed because in the case when user loads
   * the processing route URL directly the asset data might not be here yet.
   */
  private startupStore() {
    if (isAnyProcessingRouteActive()) {
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
    const newPath = data.location.pathname;

    // Store path for future `onRouteChange`s.
    // Note: Make sure not to use `this.previousPath` in the further code within
    // this function! I save it here, because the code doesn't always reach
    // the end of the function :)
    const oldPath = this.previousPath;
    this.previousPath = newPath;

    // Skip non-changes; not sure if this happens, but better safe than sorry.
    if (oldPath === newPath) {
      return;
    }

    let previousPathParts;
    if (oldPath) {
      previousPathParts = getProcessingRouteParts(oldPath);
    }
    const newPathParts = getProcessingRouteParts(newPath);

    // Cleanup: When we leave Analysis tab, we need to reset the flag
    // responsible for keeping the status of unsaved changes. This way it's not
    // blocking the navigation after leaving the tab directly from editing.
    if (previousPathParts?.tabName === ProcessingTab.Analysis) {
      this.setAnalysisTabHasUnsavedChanges(false);
    }

    // Case 1: navigating to different processing tab, but within the same
    // submission and question (neither entering nor leaving Single Processing
    // View)
    if (
      isAnyProcessingRoute(oldPath) &&
      isAnyProcessingRoute(newPath) &&
      previousPathParts &&
      previousPathParts.assetUid === newPathParts.assetUid &&
      previousPathParts.xpath === newPathParts.xpath &&
      previousPathParts.submissionEditId === newPathParts.submissionEditId &&
      // This check is needed to avoid going into this in case when route
      // redirects from no tab (e.g. `/`) into default tab (e.g. `/transcript`).
      previousPathParts.tabName !== undefined &&
      previousPathParts.tabName !== newPathParts.tabName
    ) {
      // When changing tab, discard all drafts and the selected source.
      this.data.transcriptDraft = undefined;
      this.data.translationDraft = undefined;
      this.data.source = undefined;
    }

    // Case 2: navigating to a different submission or different question
    // (neither entering nor leaving Single Processing View)
    if (
      isAnyProcessingRoute(oldPath) &&
      isAnyProcessingRoute(newPath) &&
      previousPathParts &&
      previousPathParts.assetUid === newPathParts.assetUid &&
      (previousPathParts.xpath !== newPathParts.xpath ||
        previousPathParts.submissionEditId !== newPathParts.submissionEditId)
    ) {
      this.fetchProcessingData();
      this.fetchSubmissionData();
    }

    // Case 3: switching into processing route out of other place (most
    // probably from assets data table route).
    if (!isAnyProcessingRoute(oldPath) && isAnyProcessingRoute(newPath)) {
      this.fetchAllInitialDataForAsset();
      // Each time user visits Processing View from some different route we want
      // to present the same default displays.
      this.displays = this.getInitialDisplays();
    }
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

    // We need to get a regular path (not xpath!) for each of the processing
    // rows. In theory we could just convert the xpath strings, but it's safer
    // to use the asset data that we already have.
    const processingRowsPaths: string[] = [];

    if (asset?.content?.survey) {
      flatPaths = getSurveyFlatPaths(asset.content.survey);

      if (processingRows) {
        processingRows.forEach((xpath) => {
          if (asset?.content) {
            // Here we need to "convert" xpath into name, as flatPaths work with
            // names only. We search the row by xpath and use its name.
            const rowName = getRowNameByXpath(asset.content, xpath);

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
        processingRows.forEach((xpath) => {
          submissionsEditIds[xpath] = [];
        });

        response.results.forEach((result) => {
          processingRows.forEach((xpath) => {
            if (asset?.content) {
              // Here we need to "convert" xpath into name, as flatPaths work with
              // names only. We search the row by xpath and use its name.
              const rowName = getRowNameByXpath(asset.content, xpath);

              if (rowName) {
                // `meta/rootUuid` is persistent across edits while `_uuid` is not;
                // use the persistent identifier if present.
                let uuid = result['meta/rootUuid'];
                if (uuid === undefined) {
                  uuid = result['_uuid'];
                }
                submissionsEditIds[xpath].push({
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
    this.data.isFetchingData = true;
    this.trigger(this.data);
  }

  private onFetchProcessingDataCompleted(response: ProcessingDataResponse) {
    const transcriptResponse = response[this.currentQuestionXpath]?.transcript;
    // NOTE: we treat empty transcript object same as nonexistent one
    this.data.transcript = undefined;
    if (transcriptResponse?.value && transcriptResponse?.languageCode) {
      this.data.transcript = transcriptResponse;
    }

    const translationsResponse =
      response[this.currentQuestionXpath]?.translation;
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
    this.data.isFetchingData = false;

    this.cleanupDisplays();

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
    this.data.isFetchingData = false;
    this.data.isPollingForTranscript = false;
    this.data.isPollingForTranslation = false;
    this.trigger(this.data);
  }

  private onSetTranscriptCompleted(response: ProcessingDataResponse) {
    const transcriptResponse = response[this.currentQuestionXpath]?.transcript;

    this.data.isFetchingData = false;

    if (transcriptResponse) {
      this.data.transcript = transcriptResponse;
    }
    // discard draft after saving (exit the editor)
    this.data.transcriptDraft = undefined;
    this.setNotPristine();
    this.trigger(this.data);
  }

  private onDeleteTranscriptCompleted() {
    this.data.isFetchingData = false;
    this.data.transcript = undefined;
    this.setNotPristine();
    this.trigger(this.data);
  }

  private isAutoTranscriptionEventApplicable(event: AutoTransxEvent) {
    // Note: previously initiated automatic transcriptions may no longer be
    // applicable to the current route
    const googleTsResponse =
      event.response[this.currentQuestionXpath]?.googlets;
    return (
      event.submissionEditId === this.currentSubmissionEditId &&
      googleTsResponse &&
      this.data.transcriptDraft &&
      (googleTsResponse.languageCode ===
        this.data.transcriptDraft.languageCode ||
        googleTsResponse.languageCode === this.data.transcriptDraft.regionCode)
    );
  }

  private onRequestAutoTranscriptionCompleted(event: AutoTransxEvent) {
    if (
      !this.currentQuestionXpath ||
      !this.data.isPollingForTranscript ||
      !this.data.transcriptDraft
    ) {
      return;
    }

    const googleTsResponse = event.response[this.currentQuestionXpath]?.googlets;
    if (googleTsResponse && this.isAutoTranscriptionEventApplicable(event)) {
      this.data.isPollingForTranscript = false;
      this.data.transcriptDraft.value = googleTsResponse.value;
      this.data.exponentialBackoffCount = 1;
    }

    this.setNotPristine();
    this.trigger(this.data);
  }

  private onRequestAutoTranscriptionInProgress(event: AutoTransxEvent) {
    setTimeout(() => {
      // make sure to check for applicability *after* the timeout fires, not
      // before. someone can do a lot of navigating in 5 seconds
      if (this.isAutoTranscriptionEventApplicable(event)) {
        this.data.exponentialBackoffCount = this.data.exponentialBackoffCount + 1;
        this.data.isPollingForTranscript = true;
        this.requestAutoTranscription();
      } else {
        this.data.isPollingForTranscript = false;
      }
    }, getExponentialDelayTime(
      this.data.exponentialBackoffCount,
      envStore.data.min_retry_time,
      envStore.data.max_retry_time
    ));
  }

  private onSetTranslationCompleted(newTranslations: Transx[]) {
    this.data.isFetchingData = false;
    this.data.translations = newTranslations;
    // discard draft after saving (exit the editor)
    this.data.translationDraft = undefined;
    this.data.source = undefined;
    this.setNotPristine();
    this.trigger(this.data);
  }

  private isAutoTranslationEventApplicable(event: AutoTransxEvent) {
    const googleTxResponse =
      event.response[this.currentQuestionXpath]?.googletx;
    return (
      event.submissionEditId === this.currentSubmissionEditId &&
      googleTxResponse &&
      this.data.translationDraft &&
      (googleTxResponse.languageCode ===
        this.data.translationDraft.languageCode ||
        googleTxResponse.languageCode === this.data.translationDraft.regionCode)
    );
  }

  private onRequestAutoTranslationCompleted(event: AutoTransxEvent) {
    if (
      !this.currentQuestionXpath ||
      !this.data.isPollingForTranslation ||
      !this.data.translationDraft
    ) {
      return;
    }

    const googleTxResponse = event.response[this.currentQuestionXpath]?.googletx;
    if (
      googleTxResponse &&
      this.isAutoTranslationEventApplicable(event)
    ) {
      this.data.translationDraft.value = googleTxResponse.value;
      this.data.exponentialBackoffCount = 1;
    }

    this.setNotPristine();
    this.trigger(this.data);
  }

  private onRequestAutoTranslationInProgress(event: AutoTransxEvent) {
    setTimeout(() => {
      // make sure to check for applicability *after* the timeout fires, not
      // before. someone can do a lot of navigating in 5 seconds
      if (this.isAutoTranslationEventApplicable(event)) {
        this.data.exponentialBackoffCount = this.data.exponentialBackoffCount + 1;
        this.data.isPollingForTranslation = true;
        console.log('trying to poll!'); // TEMP DELETEME
        this.requestAutoTranslation(
          event.response[this.currentQuestionXpath]!.googlets!.languageCode
        );
      } else {
        console.log('no more polling!'); // TEMP DELETEME
        this.data.isPollingForTranslation = false;
      }
    }, getExponentialDelayTime(
      this.data.exponentialBackoffCount,
      envStore.data.min_retry_time,
      envStore.data.max_retry_time
    ));
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

  /** Returns a local cached transcript data. */
  getTranscript() {
    return this.data.transcript;
  }

  setTranscript(languageCode: LanguageCode, value: string) {
    this.data.isFetchingData = true;
    processingActions.setTranscript(
      this.currentAssetUid,
      this.currentQuestionXpath,
      this.currentSubmissionEditId,
      languageCode,
      value
    );
    this.trigger(this.data);
  }

  deleteTranscript() {
    this.data.isFetchingData = true;
    processingActions.deleteTranscript(
      this.currentAssetUid,
      this.currentQuestionXpath,
      this.currentSubmissionEditId
    );
    this.trigger(this.data);
  }

  requestAutoTranscription() {
    this.data.isPollingForTranscript = true;
    processingActions.requestAutoTranscription(
      this.currentAssetUid,
      this.currentQuestionXpath,
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

  safelyDeleteTranscriptDraft() {
    if (this.hasUnsavedTranscriptDraftValue()) {
      destroyConfirm(
        this.deleteTranscriptDraft.bind(this),
        t('Discard unsaved changes?'),
        t('Discard')
      );
    } else {
      this.deleteTranscriptDraft();
    }
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
    this.data.isFetchingData = true;
    processingActions.setTranslation(
      this.currentAssetUid,
      this.currentQuestionXpath,
      this.currentSubmissionEditId,
      languageCode,
      value
    );
    this.trigger(this.data);
  }

  deleteTranslation(languageCode: LanguageCode) {
    this.data.isFetchingData = true;
    processingActions.deleteTranslation(
      this.currentAssetUid,
      this.currentQuestionXpath,
      this.currentSubmissionEditId,
      languageCode
    );
    this.trigger(this.data);
  }

  requestAutoTranslation(languageCode: string) {
    this.data.isPollingForTranslation = true;
    processingActions.requestAutoTranslation(
      this.currentAssetUid,
      this.currentQuestionXpath,
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
    this.trigger(this.data);
  }

  deleteTranslationDraft() {
    this.data.translationDraft = undefined;
    // If we clear the draft, we remove the source too.
    this.data.source = undefined;
    this.trigger(this.data);
  }

  safelyDeleteTranslationDraft() {
    if (this.hasUnsavedTranslationDraftValue()) {
      destroyConfirm(
        this.deleteTranslationDraft.bind(this),
        t('Discard unsaved changes?'),
        t('Discard')
      );
    } else {
      this.deleteTranslationDraft();
    }
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

  getSubmissionData() {
    return this.data.submissionData;
  }

  /** NOTE: Returns editIds for current question name, not for all of them. */
  getCurrentQuestionSubmissionsEditIds() {
    if (this.data.submissionsEditIds !== undefined) {
      return this.data.submissionsEditIds[this.currentQuestionXpath];
    }
    return undefined;
  }

  getProcessedFileLabel() {
    if (this.currentQuestionType === QUESTION_TYPES.audio.id) {
      return QUESTION_TYPES.audio.label.toLowerCase();
    } else if (this.currentQuestionType === QUESTION_TYPES['background-audio'].id) {
      return QUESTION_TYPES['background-audio'].label.toLowerCase();
    }
    // Fallback
    return t('source file');
  }

  getSubmissionsEditIds() {
    return this.data.submissionsEditIds;
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
      this.hasUnsavedTranslationDraftValue() ||
      this.analysisTabHasUnsavedWork
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

  getDisplayedLanguagesList(): KoboSelectOption[] {
    const languagesList = [];

    languagesList.push({label: t('XML values'), value: XML_VALUES_OPTION_VALUE});
    const asset = assetStore.getAsset(this.currentAssetUid);
    const baseLabel = t('Labels');

    // If there are some languages defined in the form, we build a list of
    // options - one for each language…
    if (asset?.summary?.languages && asset?.summary?.languages.length > 0) {
      asset.summary.languages.forEach((language) => {
        let label = baseLabel;
        if (language !== null) {
          label += ` - ${language}`;
        }
        languagesList.push({label: label, value: language});
      });
    // …otherwise we creat a single "default language" option that uses empty
    // string as value.
    } else {
      languagesList.push({label: baseLabel, value: ''});
    }

    return languagesList;
  }

  getInitialDisplayedLanguage() {
    const asset = assetStore.getAsset(this.currentAssetUid);
    if (asset?.summary?.languages && asset?.summary?.languages[0]) {
      return asset?.summary?.languages[0];
    } else {
      return '';
    }
  }

  getCurrentlyDisplayedLanguage() {
    return this.data.currentlyDisplayedLanguage;
  }

  getInitialDisplays(): SidebarDisplays {
    return {
      transcript: DefaultDisplays.get(ProcessingTab.Transcript) || [],
      translations: DefaultDisplays.get(ProcessingTab.Translations) || [],
      analysis: DefaultDisplays.get(ProcessingTab.Analysis) || [],
    };
  }

  /** Returns available displays for given tab */
  getAvailableDisplays(tabName: ProcessingTab) {
    const outcome: DisplaysList = [StaticDisplays.Audio, StaticDisplays.Data];
    if (tabName !== ProcessingTab.Transcript && this.data.transcript) {
      outcome.push(StaticDisplays.Transcript);
    }
    this.getTranslations().forEach((translation) => {
      outcome.push(translation.languageCode);
    });
    return outcome;
  }

  /** Returns displays for given tab. */
  getDisplays(tabName: ProcessingTab | undefined) {
    if (tabName !== undefined) {
      return this.displays[tabName];
    }
    return [];
  }

  getAllSidebarQuestions() {
    const asset = assetStore.getAsset(this.currentAssetUid);

    if (asset?.content?.survey) {
      const questionsList = getFlatQuestionsList(
        asset.content.survey,
        getLanguageIndex(asset, this.data.currentlyDisplayedLanguage)
      )
        .filter((question) => !(question.name === this.currentQuestionName))
        .map((question) => {
          // We make an object to show the question label to the user but use the
          // name internally so it works with duplicate question labels
          return {name: question.name, label: question.label};
        });
      return questionsList;
    } else {
      return [];
    }
  }

  getHiddenSidebarQuestions() {
    return this.data.hiddenSidebarQuestions;
  }

  /** Updates the list of active displays for given tab. */
  setDisplays(tabName: ProcessingTab, displays: DisplaysList) {
    this.displays[tabName] = displays;
    this.trigger(this.displays);
  }

  /** Resets the list of displays for given tab to a default list. */
  resetDisplays(tabName: ProcessingTab) {
    this.displays[tabName] = DefaultDisplays.get(tabName) || [];
    this.trigger(this.displays);
  }

  /**
   * Removes nonexistent displays from the list of active displays, e.g. when
   * use activated "Polish (pl)" translation to appear in sidebar, but then
   * removed it, it should also disappear from the displays list. Leftovers
   * would usually cause no problems - until user re-adds that "Polish (pl)"
   * translation.
   */
  cleanupDisplays() {
    Object.values<ProcessingTab>(ProcessingTab).forEach((tab) => {
      const availableDisplays = this.getAvailableDisplays(tab);
      this.displays[tab].filter((display) => {
        availableDisplays.includes(display);
      });
    });
    this.trigger(this.displays);
  }

  /** Updates store with the unsaved changes state from the analysis reducer. */
  setAnalysisTabHasUnsavedChanges(hasUnsavedWork: boolean) {
    this.analysisTabHasUnsavedWork = hasUnsavedWork;
    if (hasUnsavedWork) {
      this.setNotPristine();
    }
    this.trigger(this.data);
  }

  /**
   * Marks the data as having some changes being made (both saved and unsaved).
   * There is no need to set it back to pristine, as it happens only after
   */
  setNotPristine() {
    if (this.data.isPristine) {
      this.data.isPristine = false;
      this.trigger(this.data);
    }
  }

  setHiddenSidebarQuestions(list: string[]) {
    this.data.hiddenSidebarQuestions = list;

    this.trigger(this.data);
  }

  setCurrentlyDisplayedLanguage(language: LanguageCode) {
    this.data.currentlyDisplayedLanguage = language;

    this.trigger(this.data);
  }
}

/**
 * Stores all data necessary for rendering the single processing route and all
 * its features. Handles draft transcripts/translations.
 */
const singleProcessingStore = new SingleProcessingStore();
singleProcessingStore.init();

export default singleProcessingStore;
