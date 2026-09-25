import { Box } from '@mantine/core'
import alertify from 'alertifyjs'
import clonedeep from 'lodash.clonedeep'
import debounce from 'lodash.debounce'
import last from 'lodash.last'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import DocumentTitle from 'react-document-title'
import { useBeforeUnload, useBlocker } from 'react-router-dom'
import type { AssetSnapshotResponse } from '#/api/models/assetSnapshotResponse'
import { invalidateItem } from '#/api/mutation-defaults/common'
import { getAssetsRetrieveQueryKey, useAssetsRetrieve } from '#/api/react-query/manage-projects-and-library-content'
import assetUtils from '#/assetUtils'
import { makeBem } from '#/bem'
import LoadingSpinner from '#/components/common/loadingSpinner'
import Modal from '#/components/common/modal'
import {
  type KoboMatrixParserParams,
  getFormBuilderAssetType,
  koboMatrixParser,
  surveyToValidJson,
  unnullifyTranslations,
} from '#/components/formBuilder/formBuilderUtils'
import FormLockedMessage from '#/components/locking/formLockedMessage'
import {
  ASSET_TYPES,
  AssetTypeName,
  type FormStyleName,
  QuestionTypeName,
  type UpdateStatesValue,
  update_states,
} from '#/constants'
import type { RouterProp } from '#/router/legacy'
import { ROUTES } from '#/router/routerConstants'
import dkobo_xlform from '../../xlform/src/_xlform.init'
import type { Survey } from '../../xlform/src/model.survey'
import type { SurveyDetail } from '../../xlform/src/model.surveyDetail'
import type { SurveyApp } from '../../xlform/src/view.surveyApp'
import { actions } from '../actions'
import {
  type AssetContent,
  type AssetRequestObject,
  type AssetResponse,
  type AssetResponseFile,
  type FailResponse,
  dataInterface,
} from '../dataInterface'
import SurveyScope from '../models/surveyScope'
import { type SurveyStateStoreData, stores } from '../stores'
import { escapeHtml, recordKeys } from '../utils'
import FormbuilderBackgroundAudioWarning from './FormbuilderBackgroundAudioWarning'
import FormbuilderHeader from './FormbuilderHeader'
import FormbuilderSidebar from './FormbuilderSidebar'

const ErrorMessage = makeBem(null, 'error-message')
const ErrorMessage__strong = makeBem(null, 'error-message__header', 'strong')

const UNSAVED_CHANGES_WARNING = t('You have unsaved changes. Leave form without saving?')
const ASIDE_CACHE_NAME = 'kpi.editable-form.aside'

interface LaunchAppData {
  name: string
  settings__style?: FormStyleName
  files: AssetResponseFile[]
  asset_type: AssetTypeName
  asset: AssetResponse
}

interface AsideSettings {
  asideLayoutSettingsVisible: boolean
  asideLibrarySearchVisible: boolean
}

interface EditableFormProps {
  assetUid?: string
  isNewAsset?: boolean
  backRoute: string | null
  parentAssetUid?: string
  router: RouterProp
}

interface EditableFormState extends SurveyStateStoreData {
  isNewAsset?: boolean
  backRoute?: string
  asideLayoutSettingsVisible: boolean
  asideLibrarySearchVisible: boolean
  asset: AssetResponse | undefined
  asset_updated: UpdateStatesValue
  desiredAssetType: AssetTypeName | undefined
  enketopreviewError?: string
  enketopreviewOverlay: string | undefined
  isBackgroundAudioBannerDismissed: boolean
  name: string
  preventNavigatingOut: boolean
  settings__style?: FormStyleName
  surveyAppRendered: boolean
  surveyLoadError: string | undefined
  surveySaveFail: boolean
}

/**
 * This is a component that displays Form Builder's header and aside. It is also
 * responsible for rendering the survey editor app (all our coffee code). See
 * the `launchAppForSurveyContent` method below for all the magic.
 */
export default function EditableForm(props: EditableFormProps) {
  const [state, setState] = useState<EditableFormState>({
    asideLayoutSettingsVisible: false,
    asideLibrarySearchVisible: false,
    asset: undefined,
    asset_updated: update_states.UP_TO_DATE,
    desiredAssetType: undefined,
    enketopreviewOverlay: undefined,
    isBackgroundAudioBannerDismissed: false,
    name: '',
    preventNavigatingOut: false,
    surveyAppRendered: false,
    surveyLoadError: undefined,
    surveySaveFail: false,
    isNewAsset: props.isNewAsset,
    backRoute: props.backRoute === null ? undefined : props.backRoute,
    groupButtonIsActive: false,
    multioptionsExpanded: true,
  })

  const formWrapRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<SurveyApp | undefined>(undefined)

  const onSurveyChangeDebounced = debounce(onSurveyChange, 200)

  const [app, setApp] = useState<SurveyApp | undefined>(undefined)

  const assetUid = props.assetUid || ''

  const assetQuery = useAssetsRetrieve(
    assetUid,
    {},
    {
      query: {
        queryKey: getAssetsRetrieveQueryKey(assetUid),
        enabled: assetUid !== '',
        // No need to fetch it again, as the code doesn't support updating `asset` after it was already loaded
        refetchOnWindowFocus: false,
      },
    },
  )

  useEffect(() => {
    const assetData = assetQuery.data?.data
    if (assetQuery.isFetching) {
      // Wait for the fetch to settle before seeding local state.
      // Otherwise Form Builder can initialize from stale cached content and
      // carry outdated translation metadata into save payloads.
      return
    }
    if (assetData && 'uid' in assetData) {
      // TODO: stop casting this as AssetResponse after backend openAPI task DEV-1727 is done
      const assetDataCast = assetData as unknown as AssetResponse
      setState((currentState) => {
        return {
          ...currentState,
          // Deep clone the react-query cache reference to prevent mutations to survey.availableFiles
          // from corrupting the cache. Form Builder code mutates asset properties during initialization.
          // TODO: storing asset that we already have in `assetQuery` is not nice. I left it like this to avoid requiring
          // too much refactor in here.
          asset: clonedeep(assetDataCast),
        }
      })
    }
  }, [assetQuery.data?.data, assetQuery.isFetching])

  useEffect(() => {
    if (state.asset) {
      let settingsStyle: FormStyleName | undefined
      if (state.asset.content?.settings && !Array.isArray(state.asset.content?.settings)) {
        settingsStyle = state.asset.content.settings.style
      }
      launchAppForSurveyContent(state.asset.content, {
        name: state.asset.name,
        settings__style: settingsStyle,
        files: state.asset.files,
        asset_type: state.asset.asset_type,
        asset: state.asset,
      })
    }
  }, [state.asset])

  useEffect(() => {
    loadAsideSettings()

    if (state.isNewAsset) {
      launchAppForSurveyContent()
    }

    stores.surveyState.listen(onSurveyStateChanged)

    return () => {
      unpreventClosingTab()
      cleanupAppForSurveyContent()
    }
  }, [])

  useBeforeUnload(
    useCallback(
      (event) => {
        if (state.preventNavigatingOut) {
          event.preventDefault()
        }
      },
      [state.preventNavigatingOut],
    ),
  )
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      state.preventNavigatingOut && currentLocation.pathname !== nextLocation.pathname,
  )

  useEffect(() => {
    if (blocker.state === 'blocked') {
      if (window.confirm(UNSAVED_CHANGES_WARNING)) {
        blocker.proceed()
      } else {
        blocker.reset()
      }
    }
  }, [blocker])

  function loadAsideSettings() {
    const asideSettings = sessionStorage.getItem(ASIDE_CACHE_NAME)
    if (asideSettings) {
      setState((currentState) => ({
        ...currentState,
        ...JSON.parse(asideSettings),
      }))
    }
  }

  function saveAsideSettings(asideSettings: AsideSettings) {
    sessionStorage.setItem(ASIDE_CACHE_NAME, JSON.stringify(asideSettings))
  }

  function onMetadataEditorChange() {
    onSurveyChangeDebounced()
  }

  function onSurveyStateChanged(storeState: SurveyStateStoreData) {
    setState((currentState) => ({
      ...currentState,
      ...storeState,
    }))
  }

  function onStyleChange(newValue: string | null) {
    const settingsStyle = (newValue ?? '') as FormStyleName

    setState((currentState) => ({
      ...currentState,
      settings__style: settingsStyle,
    }))
    onSurveyChangeDebounced()
  }

  function onSurveyChange() {
    if (!state.asset_updated !== update_states.UNSAVED_CHANGES) {
      preventClosingTab()
    }
    setState((currentState) => ({
      ...currentState,
      asset_updated: update_states.UNSAVED_CHANGES,
    }))
  }

  function preventClosingTab() {
    setState((currentState) => ({
      ...currentState,
      preventNavigatingOut: true,
    }))
    $(window).on('beforeunload.noclosetab', () => UNSAVED_CHANGES_WARNING)
  }

  function unpreventClosingTab() {
    setState((currentState) => ({
      ...currentState,
      preventNavigatingOut: false,
    }))
    $(window).off('beforeunload.noclosetab')
  }

  function nameChange(evt: React.ChangeEvent<HTMLInputElement>) {
    setState((currentState) => ({
      ...currentState,
      name: assetUtils.removeInvalidChars(evt.target.value),
    }))
    onSurveyChangeDebounced()
  }

  function groupQuestions() {
    app?.groupSelectedRows()
  }

  function showAll(evt: React.TouchEvent<HTMLButtonElement>) {
    evt.preventDefault()
    evt.currentTarget.blur()
    app?.expandMultioptions()
  }

  function hasMetadataAndDetails() {
    return (
      app &&
      state.asset &&
      (state.asset.asset_type === ASSET_TYPES.survey.id ||
        state.asset.asset_type === ASSET_TYPES.template.id ||
        state.desiredAssetType === ASSET_TYPES.template.id)
    )
  }

  function previewForm(evt: React.TouchEvent<HTMLButtonElement>) {
    // At this point app should really be defined, and if not, there is no point in doing anything
    if (!app) {
      console.error('app is not defined!')
      return
    }

    if (evt && evt.preventDefault) {
      evt.preventDefault()
    }

    if (state.settings__style !== undefined) {
      app?.survey.settings.set('style', state.settings__style)
    }

    if (state.name) {
      app?.survey.settings.set('title', state.name)
    }

    let surveyJSON = surveyToValidJson(app?.survey)
    if (app?.survey._initialParams?.translations_0) {
      surveyJSON = unnullifyTranslations(surveyJSON, app.survey._initialParams)
    }
    let params: KoboMatrixParserParams & { asset?: string } = { source: surveyJSON }

    params = koboMatrixParser(params)

    if (state.asset && state.asset.url) {
      params.asset = state.asset.url
    }

    dataInterface
      .createAssetSnapshot(params)
      .done((content: AssetSnapshotResponse) => {
        setState((currentState) => ({
          ...currentState,
          enketopreviewOverlay: content.enketopreviewlink,
        }))
      })
      .fail((jqxhr: FailResponse) => {
        let err
        if (jqxhr && jqxhr.responseJSON && jqxhr.responseJSON.error) {
          err = jqxhr.responseJSON.error
        } else {
          err = t('Unknown Enketo preview error')
        }
        setState((currentState) => ({
          ...currentState,
          enketopreviewError: err,
        }))
      })
  }

  function saveForm(evt: React.TouchEvent<HTMLButtonElement>) {
    if (evt && evt.preventDefault) {
      evt.preventDefault()
    }
    // At this point app should really be defined, and if not, there is no point in doing anything
    if (!app) {
      console.error('app is not defined!')
      return
    }

    if (state.settings__style !== undefined) {
      app.survey.settings.set('style', state.settings__style)
    }

    let surveyJSON = surveyToValidJson(app.survey)
    const surveyJSONWithMatrix = koboMatrixParser({ source: surveyJSON }).source
    if (surveyJSONWithMatrix) {
      surveyJSON = surveyJSONWithMatrix
    }
    if (app.survey._initialParams?.translations_0) {
      surveyJSON = unnullifyTranslations(surveyJSON, app.survey._initialParams)
    }
    // We normally have `content` as an actual object, not a stringified representation, but since
    // `actions.resources.updateAsset` already works with JSON string, let's extend the types
    const params: Partial<AssetRequestObject> & { content: string } = { content: surveyJSON }

    if (state.name) {
      params.name = state.name
    }

    if (state.isNewAsset) {
      // we're intentionally leaving after creating new asset,
      // so there is nothing unsaved here
      unpreventClosingTab()

      // create new asset
      if (state.desiredAssetType) {
        params.asset_type = state.desiredAssetType
      } else {
        params.asset_type = AssetTypeName.block
      }
      if (props.parentAssetUid) {
        params.parent = assetUtils.buildAssetUrl(props.parentAssetUid)
      }
      actions.resources.createResource.triggerAsync(params).then(() => {
        if (props.router && state.backRoute) {
          props.router.navigate(state.backRoute)
        }
      })
    } else if (assetUid !== '') {
      // TODO: change this into react-query mutation
      actions.resources.updateAsset
        .triggerAsync(assetUid, params)
        .then(() => {
          unpreventClosingTab()
          // We need to invalidate it here to force it to fetch fresh data. Without this a bug will happen with Form
          // Builder showing old data in some scenarios (e.g. after closing Form Builder and immediately visiting again).
          invalidateItem(getAssetsRetrieveQueryKey(assetUid))
          setState((currentState) => ({
            ...currentState,
            asset_updated: update_states.UP_TO_DATE,
            surveySaveFail: false,
          }))
        })
        .catch((resp: FailResponse) => {
          var errorMsg = `${t('Your changes could not be saved, likely because of a lost internet connection.')}&nbsp;${t('Keep this window open and try saving again while using a better connection.')}`
          if (resp.statusText !== 'error') {
            errorMsg = escapeHtml(resp.statusText)
          }

          alertify.defaults.theme.ok = 'ajs-cancel'
          const dialog = alertify.dialog('alert')
          const opts = {
            title: t('Error saving form'),
            message: errorMsg,
            label: t('Dismiss'),
          }
          dialog.set(opts).show()

          setState((currentState) => ({
            ...currentState,
            surveySaveFail: true,
            asset_updated: update_states.SAVE_FAILED,
          }))
        })
    }
    setState((currentState) => ({
      ...currentState,
      asset_updated: update_states.PENDING_UPDATE,
    }))
  }

  function toggleAsideLibrarySearch(evt: React.TouchEvent<HTMLButtonElement>) {
    evt.currentTarget.blur()
    const asideSettings: AsideSettings = {
      asideLayoutSettingsVisible: false,
      asideLibrarySearchVisible: !state.asideLibrarySearchVisible,
    }
    setState((currentState) => ({
      ...currentState,
      ...asideSettings,
    }))
    saveAsideSettings(asideSettings)
  }

  function toggleAsideLayoutSettings(evt: React.TouchEvent<HTMLButtonElement>) {
    evt.currentTarget.blur()
    const asideSettings: AsideSettings = {
      asideLayoutSettingsVisible: !state.asideLayoutSettingsVisible,
      asideLibrarySearchVisible: false,
    }
    setState((currentState) => ({
      ...currentState,
      ...asideSettings,
    }))
    saveAsideSettings(asideSettings)
  }

  function hidePreview() {
    setState((currentState) => ({
      ...currentState,
      enketopreviewOverlay: undefined,
    }))
  }

  /**
   * Cleanup some things in the rendered app
   */
  function cleanupAppForSurveyContent() {
    // Use appRef to access the current app instance, not the closure-captured app value
    const currentApp = appRef.current
    if (currentApp?.survey) {
      currentApp.survey.off('change')
      currentApp.survey.rows.off('change')
      currentApp.survey.rows.off('sort')
    }
  }

  /**
   * The de facto function that is running our Form Builder survey editor app.
   * It builds `dkobo_xlform.view.SurveyApp` using asset data and then appends
   * it to `.form-wrap` node.
   */
  function launchAppForSurveyContent(assetContent?: AssetContent, _state?: LaunchAppData) {
    // If we already rendered the app in the formWrapRef container, there is no need to do it again. Without this check
    // we would end up adding copies of the app in HTML
    // Use appRef to check for existing app - state may not have updated yet if called during rapid re-renders
    if (appRef.current !== undefined) {
      return
    }

    const newState: Partial<EditableFormState> & Partial<LaunchAppData> = _state || {}

    // asset content is being mutated somewhere during form builder initialisation
    // so we need to make sure this stays untouched
    const rawAssetContent = Object.freeze(clonedeep(assetContent))

    const isEmptySurvey =
      assetContent &&
      assetContent.settings &&
      recordKeys(assetContent.settings).length === 0 &&
      assetContent.survey?.length === 0

    let survey: Survey | null = null

    try {
      if (assetContent) {
        survey = dkobo_xlform.model.Survey.loadDict(clonedeep(assetContent))
        if (newState.files && newState.files.length > 0) {
          survey.availableFiles = newState.files
        }
        if (isEmptySurvey) {
          survey.surveyDetails.importDefaults()
        }
      } else {
        survey = dkobo_xlform.model.Survey.create()
      }
    } catch (err) {
      const errObject = (err as unknown as { message?: string }) || {}
      newState.surveyLoadError = errObject.message || 'dkobo_xlform failed'
      newState.surveyAppRendered = false
    }

    if (survey && !newState.surveyLoadError) {
      newState.surveyAppRendered = true

      var skp = new SurveyScope({
        survey: survey,
        rawSurvey: rawAssetContent,
        assetType: getFormBuilderAssetType(state.asset?.asset_type, state.desiredAssetType),
      })

      const newApp = new dkobo_xlform.view.SurveyApp({
        survey: survey,
        stateStore: stores.surveyState,
        ngScope: skp,
      })

      // Store in both state and ref - ref ensures cleanup always has access to current app
      appRef.current = newApp
      setApp(newApp)

      const formWrapEl = formWrapRef.current

      if (formWrapEl instanceof Element === false) {
        throw new Error('form-wrap element not found!')
      }

      newApp.$el.appendTo(formWrapEl)
      newApp.render()
      survey.rows.on('change', onSurveyChange)
      survey.rows.on('sort', onSurveyChange)
      survey.on('change', onSurveyChange)
    }

    setState((currentState) => ({
      ...currentState,
      ...newState,
    }))
  }

  function clearPreviewError() {
    setState((currentState) => ({
      ...currentState,
      enketopreviewError: undefined,
    }))
  }

  function safeNavigateToList() {
    if (state.backRoute) {
      props.router.navigate(state.backRoute)
    } else if (props.router.location.pathname.startsWith(ROUTES.LIBRARY)) {
      props.router.navigate(ROUTES.LIBRARY)
    } else {
      props.router.navigate(ROUTES.FORMS)
    }
  }

  function safeNavigateToAsset() {
    // Previously this was checking for asset, but when you create a "block", asset will be created only after saving,
    // so we need to allow users going back without saving.
    if (!state.backRoute) {
      return
    }

    let targetRoute = state.backRoute
    if (state.backRoute === ROUTES.FORMS) {
      if (assetUid !== '') {
        targetRoute = ROUTES.FORM.replace(':uid', assetUid)
      }
    } else if (state.backRoute === ROUTES.LIBRARY) {
      // Check if the the uid is undefined to prevent getting an Access Denied screen
      if (assetUid !== '') {
        targetRoute = ROUTES.LIBRARY_ITEM.replace(':uid', assetUid)
      }
    }

    props.router.navigate(targetRoute)
  }

  // For the next four functions, FormbuilderHeader can't touch `app` directly, so these helpers are passed down as props

  // Insert cascade after last selected row
  function getCascadeInsertIndex(): number {
    const lastSelectedRow = last(app?.selectedRows())
    return lastSelectedRow ? (app?.survey.rows.indexOf(lastSelectedRow) ?? -1) : -1
  }

  // Give parsed cascade survey to coffee code
  function insertCascade(survey: Survey, rowIndex: number | undefined) {
    app?.survey?.insertSurvey(survey, rowIndex)
  }

  // Used to disable the preview button when the form is empty
  function getSurveyHasRows(): boolean {
    return (app?.survey?.rows.length ?? 0) >= 1
  }

  // Used to enable the "show all" button only when there's something to expand
  function getSurveyHasSelectQuestion(): boolean {
    let hasSelect = false
    app?.survey?.forEachRow((row: any) => {
      if (row._isSelectQuestion()) {
        hasSelect = true
      }
    })
    return hasSelect
  }

  function hasBackgroundAudio() {
    return app?.survey?.surveyDetails.filter(
      (sd: SurveyDetail) => sd.attributes.name === QuestionTypeName['background-audio'],
    )[0].attributes.value
  }

  // rendering methods

  function renderNotLoadedMessage() {
    if (state.surveyLoadError) {
      return (
        <ErrorMessage>
          <ErrorMessage__strong>{t('Error loading survey:')}</ErrorMessage__strong>
          <p>{state.surveyLoadError}</p>
        </ErrorMessage>
      )
    }

    return <LoadingSpinner />
  }

  var docTitle = state.name || t('Untitled')

  if (!state.isNewAsset && !state.asset) {
    return (
      <DocumentTitle title={`${docTitle} | KoboToolbox`}>
        <LoadingSpinner />
      </DocumentTitle>
    )
  }

  return (
    <DocumentTitle title={`${docTitle} | KoboToolbox`}>
      <>
        <div className='form-builder-wrapper'>
          <FormbuilderSidebar
            asideLayoutSettingsVisible={state.asideLayoutSettingsVisible}
            asideLibrarySearchVisible={state.asideLibrarySearchVisible}
            settings__style={state.settings__style}
            backRoute={state.backRoute}
            onStyleChange={onStyleChange}
            onMetadataEditorChange={onMetadataEditorChange}
            survey={app?.survey}
            asset={state.asset}
            desiredAssetType={state.desiredAssetType}
            hasMetadataAndDetails={!!hasMetadataAndDetails()}
          />

          <Box className='form-builder'>
            <FormbuilderHeader
              // Header props
              name={state.name}
              asset={state.asset}
              desiredAssetType={state.desiredAssetType}
              asset_updated={state.asset_updated}
              surveyAppRendered={state.surveyAppRendered}
              surveyLoadError={state.surveyLoadError}
              surveySaveFail={state.surveySaveFail}
              isNewAsset={state.isNewAsset}
              groupButtonIsActive={state.groupButtonIsActive}
              asideLibrarySearchVisible={state.asideLibrarySearchVisible}
              asideLayoutSettingsVisible={state.asideLayoutSettingsVisible}
              hasMetadataAndDetails={!!hasMetadataAndDetails()}
              surveyHasRows={getSurveyHasRows()}
              surveyHasSelectQuestion={getSurveyHasSelectQuestion()}
              onNavigateToList={safeNavigateToList}
              onNavigateToAsset={safeNavigateToAsset}
              onSave={saveForm}
              onPreview={previewForm}
              onNameChange={nameChange}
              onShowAll={showAll}
              onGroupQuestions={groupQuestions}
              onToggleAsideLibrarySearch={toggleAsideLibrarySearch}
              onToggleAsideLayoutSettings={toggleAsideLayoutSettings}
              // Cascade props
              onGetCascadeInsertIndex={getCascadeInsertIndex}
              onInsertCascade={insertCascade}
            />

            <Box className='form-builder__contents'>
              {state.asset && <FormLockedMessage asset={state.asset} />}

              {hasBackgroundAudio() && !state.isBackgroundAudioBannerDismissed && (
                <FormbuilderBackgroundAudioWarning
                  onDismiss={() => {
                    setState((currentState) => ({
                      ...currentState,
                      isBackgroundAudioBannerDismissed: true,
                    }))
                  }}
                />
              )}

              <div ref={formWrapRef} className='form-wrap'>
                {!state.surveyAppRendered && renderNotLoadedMessage()}
              </div>
            </Box>
          </Box>

          {state.enketopreviewOverlay && (
            <Modal open large onClose={hidePreview} title={t('Form Preview')}>
              <Modal.Body>
                <div className='enketo-holder'>
                  <iframe src={state.enketopreviewOverlay} />
                </div>
              </Modal.Body>
            </Modal>
          )}

          {!state.enketopreviewOverlay && state.enketopreviewError && (
            // This used to have `error` prop, but `modal.tsx` no longer has the prop. I am leaving this comment here
            // as I am not sure how to test this, and maybe the popup should appear differently?
            <Modal open onClose={clearPreviewError} title={t('Error generating preview')}>
              <Modal.Body>{state.enketopreviewError}</Modal.Body>
            </Modal>
          )}

        </div>
      </>
    </DocumentTitle>
  )
}
