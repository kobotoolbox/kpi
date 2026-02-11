import React, { useCallback, useEffect, useRef, useState } from 'react'

import { Text } from '@mantine/core'
import alertify from 'alertifyjs'
import cx from 'classnames'
import clonedeep from 'lodash.clonedeep'
import debounce from 'lodash.debounce'
import last from 'lodash.last'
import DocumentTitle from 'react-document-title'
import Markdown from 'react-markdown'
import { useBeforeUnload, useBlocker, unstable_usePrompt as usePrompt } from 'react-router-dom'
import Select from 'react-select'
import type { AssetSnapshotResponse } from '#/api/models/assetSnapshotResponse'
import { getAssetsRetrieveQueryKey, useAssetsRetrieve } from '#/api/react-query/manage-projects-and-library-content'
import assetUtils from '#/assetUtils'
import bem, { makeBem } from '#/bem'
import Alert from '#/components/common/alert'
import Button from '#/components/common/button'
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
import { LOCKING_UI_CLASSNAMES, LockingRestrictionName } from '#/components/locking/lockingConstants'
import {
  hasAssetAnyLocking,
  hasAssetRestriction,
  isAssetAllLocked,
  isAssetLockable,
} from '#/components/locking/lockingUtils'
import MetadataEditor from '#/components/metadataEditor'
import {
  ASSET_TYPES,
  AVAILABLE_FORM_STYLES,
  AssetTypeName,
  type FormStyleDefinition,
  type FormStyleName,
  NAME_MAX_LENGTH,
  QuestionTypeName,
  type UpdateStatesValue,
  update_states,
} from '#/constants'
import envStore from '#/envStore'
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
import AssetNavigator from './AssetNavigator'

const ErrorMessage = makeBem(null, 'error-message')
const ErrorMessage__strong = makeBem(null, 'error-message__header', 'strong')
bem.CascadePopup = makeBem(null, 'cascade-popup')
bem.CascadePopup__message = makeBem(bem.CascadePopup, 'message')
bem.CascadePopup__buttonWrapper = makeBem(bem.CascadePopup, 'buttonWrapper')

const WEBFORM_STYLES_SUPPORT_URL = 'alternative_enketo.html'
const CHOICE_LIST_SUPPORT_URL = 'cascading_select.html'

const UNSAVED_CHANGES_WARNING = t('You have unsaved changes. Leave form without saving?')
/** Use usePrompt directly instead for functional components */
const Prompt = () => {
  usePrompt({ when: true, message: UNSAVED_CHANGES_WARNING })
  return <></>
}

const ASIDE_CACHE_NAME = 'kpi.editable-form.aside'
const LOCKING_SUPPORT_URL = 'library_locking.html'
const RECORDING_SUPPORT_URL = 'recording-interviews.html'

interface LaunchAppData {
  name: string
  savedName?: string
  settings__style?: FormStyleName
  files: AssetResponseFile[]
  asset_type: AssetTypeName
  asset: AssetResponse
}

interface EditableFormButtonStates {
  previewDisabled?: boolean
  groupable?: boolean
  showAllOpen?: boolean
  showAllAvailable?: boolean
  name?: string
  hasSettings?: boolean
  styleValue?: FormStyleName
  allButtonsDisabled?: boolean
  saveButtonText?: string
}

interface AsideSettings {
  asideLayoutSettingsVisible: boolean
  asideLibrarySearchVisible: boolean
}

interface EditableFormProps {
  asset_updated: UpdateStatesValue
  multioptionsExpanded: boolean
  surveyAppRendered: boolean
  name: string
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
  cascadeMessage?: {
    msgType: 'ready' | 'warning'
    addCascadeMessage?: string
    message?: string
  }
  cascadeReady: boolean
  cascadeReadySurvey?: Survey
  cascadeTextareaValue: string
  desiredAssetType: AssetTypeName | undefined
  enketopreviewError?: string
  enketopreviewOverlay: string | undefined
  isBackgroundAudioBannerDismissed: boolean
  name: string
  preventNavigatingOut: boolean
  settings__style?: FormStyleName
  showCascadePopup: boolean
  cascadeLastSelectedRowIndex?: number
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
    cascadeMessage: undefined,
    cascadeReady: false,
    cascadeTextareaValue: '',
    desiredAssetType: undefined,
    enketopreviewOverlay: undefined,
    isBackgroundAudioBannerDismissed: false,
    name: props.name,
    preventNavigatingOut: false,
    showCascadePopup: false,
    surveyAppRendered: props.surveyAppRendered,
    surveyLoadError: undefined,
    surveySaveFail: false,
    isNewAsset: props.isNewAsset,
    backRoute: props.backRoute === null ? undefined : props.backRoute,
    groupButtonIsActive: false,
    multioptionsExpanded: props.multioptionsExpanded,
  })

  const formWrapRef = useRef<HTMLDivElement>(null)
  const cascadeRef = useRef<HTMLTextAreaElement>(null)

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
      },
    },
  )

  useEffect(() => {
    const assetData = assetQuery.data?.data
    if (assetData && 'uid' in assetData) {
      // TODO: stop casting this as AssetResponse after backend openAPI task DEV-1727 is done
      const assetDataCast = assetData as unknown as AssetResponse
      setState((currentState) => ({
        ...currentState,
        // TODO: storing asset that we already have in `assetQuery` is not nice. I left it like this to avoid requiring
        // too much refactor in here.
        asset: assetDataCast,
      }))
    }
  }, [assetQuery.data?.data])

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
    // We want to trigger `launchAppForSurveyContent` only when the asset is loaded, if we put `state.asset` here it
    // would trigger it multiple times unnecessarily
  }, [state.asset?.uid])

  useEffect(() => {
    loadAsideSettings()

    if (state.isNewAsset) {
      launchAppForSurveyContent()
    }

    stores.surveyState.listen(onSurveyStateChanged)

    return () => {
      if (app?.survey) {
        app.survey.off('change')
      }
      unpreventClosingTab()
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

  function onStyleChange(newStyle: null | FormStyleDefinition) {
    let settingsStyle: FormStyleName
    if (newStyle !== null) {
      settingsStyle = newStyle.value
    }

    setState((currentState) => ({
      ...currentState,
      settings__style: settingsStyle,
    }))
    onSurveyChangeDebounced()
  }

  function getStyleSelectVal(optionVal?: FormStyleName) {
    return AVAILABLE_FORM_STYLES.find((option) => option.value === optionVal)
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

  function needsSave() {
    return state.asset_updated === update_states.UNSAVED_CHANGES
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
    if (state.asset?.content) {
      surveyJSON = unnullifyTranslations(surveyJSON, state.asset.content)
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
    if (state.asset?.content) {
      const surveyJSONWithMatrix = koboMatrixParser({ source: surveyJSON }).source
      if (surveyJSONWithMatrix) {
        surveyJSON = unnullifyTranslations(surveyJSONWithMatrix, state.asset.content)
      }
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
    } else if (props.assetUid) {
      // update existing asset
      const uid = props.assetUid

      actions.resources.updateAsset
        .triggerAsync(uid, params)
        .then(() => {
          unpreventClosingTab()
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

  function buttonStates() {
    var ooo: EditableFormButtonStates = {}
    if (app) {
      ooo.previewDisabled = true
      if (app && app.survey) {
        ooo.previewDisabled = app.survey.rows.length < 1
      }
      ooo.groupable = !!state.groupButtonIsActive
      ooo.showAllOpen = !!state.multioptionsExpanded
      ooo.showAllAvailable = (() => {
        var hasSelect = false
        app.survey.forEachRow((row) => {
          if (row._isSelectQuestion()) {
            hasSelect = true
          }
        })
        return hasSelect
      })()
      ooo.name = state.name
      ooo.hasSettings = state.backRoute === ROUTES.FORMS
      ooo.styleValue = state.settings__style
    } else {
      ooo.allButtonsDisabled = true
    }
    if (state.isNewAsset) {
      ooo.saveButtonText = t('create')
    } else if (state.surveySaveFail) {
      ooo.saveButtonText = `${t('save')} (${t('retry')}) `
    } else {
      ooo.saveButtonText = t('save')
    }
    return ooo
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

  function hideCascade() {
    setState((currentState) => ({
      ...currentState,
      showCascadePopup: false,
    }))
  }

  /**
   * The de facto function that is running our Form Builder survey editor app.
   * It builds `dkobo_xlform.view.SurveyApp` using asset data and then appends
   * it to `.form-wrap` node.
   */
  function launchAppForSurveyContent(assetContent?: AssetContent, _state?: LaunchAppData) {
    const newState: Partial<EditableFormState> & Partial<LaunchAppData> = _state || {}

    if (newState.name) {
      newState.savedName = newState.name
    }

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
        survey = dkobo_xlform.model.Survey.loadDict(assetContent)
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

      setApp(newApp)

      const formWrapEl = formWrapRef.current

      if (formWrapEl instanceof Element === false) {
        throw new Error('form-wrap element not found!')
      }

      // This ensure we don't end up with duplicated lists of form rows (multiple of apps added through `appendTo`). It
      // is not ideal, as clearing it and appending again resets all group/question toggling, settings being opened etc.
      // but we ensure it will not be called often in other code above.
      formWrapEl.innerHTML = ''
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
    if (!state.asset || !state.backRoute) {
      return
    }

    let targetRoute = state.backRoute
    if (state.backRoute === ROUTES.FORMS) {
      targetRoute = ROUTES.FORM.replace(':uid', state.asset.uid)
    } else if (state.backRoute === ROUTES.LIBRARY) {
      // Check if the the uid is undefined to prevent getting an Access Denied screen
      if (state.asset.uid !== undefined) {
        targetRoute = ROUTES.LIBRARY_ITEM.replace(':uid', state.asset.uid)
      }
    }

    props.router.navigate(targetRoute)
  }

  function isAddingQuestionsRestricted() {
    return (
      state.asset?.content &&
      isAssetLockable(state.asset.asset_type) &&
      hasAssetRestriction(state.asset.content, LockingRestrictionName.question_add)
    )
  }

  function isAddingGroupsRestricted() {
    return (
      state.asset?.content &&
      isAssetLockable(state.asset.asset_type) &&
      hasAssetRestriction(state.asset.content, LockingRestrictionName.group_add)
    )
  }

  function isChangingAppearanceRestricted() {
    return (
      state.asset?.content &&
      isAssetLockable(state.asset.asset_type) &&
      hasAssetRestriction(state.asset.content, LockingRestrictionName.form_appearance)
    )
  }

  function isChangingMetaQuestionsRestricted() {
    return (
      state.asset?.content &&
      isAssetLockable(state.asset.asset_type) &&
      hasAssetRestriction(state.asset.content, LockingRestrictionName.form_meta_edit)
    )
  }

  function hasBackgroundAudio() {
    return app?.survey?.surveyDetails.filter(
      (sd: SurveyDetail) => sd.attributes.name === QuestionTypeName['background-audio'],
    )[0].attributes.value
  }

  // rendering methods

  function renderFormBuilderHeader() {
    const { previewDisabled, groupable, showAllOpen, showAllAvailable, saveButtonText } = buttonStates()

    return (
      <bem.FormBuilderHeader>
        <bem.FormBuilderHeader__row m='primary'>
          <bem.FormBuilderHeader__cell
            m={'logo'}
            data-tip={t('Return to list')}
            className='left-tooltip'
            tabIndex='0'
            onClick={safeNavigateToList}
          >
            <i className='k-icon k-icon-kobo' />
          </bem.FormBuilderHeader__cell>

          <bem.FormBuilderHeader__cell m='name'>
            <bem.FormModal__item>
              {renderAssetLabel()}
              <input
                type='text'
                maxLength={NAME_MAX_LENGTH}
                onChange={nameChange}
                value={state.name}
                title={state.name}
                id='nameField'
                dir='auto'
              />
            </bem.FormModal__item>
          </bem.FormBuilderHeader__cell>

          <bem.FormBuilderHeader__cell m={'buttonsTopRight'}>
            <Button
              type='primary'
              size='l'
              isPending={state.asset_updated === update_states.PENDING_UPDATE}
              isDisabled={!state.surveyAppRendered || !!state.surveyLoadError}
              onClick={saveForm}
              isUpperCase
              label={
                <>
                  {saveButtonText}
                  {state.asset_updated === update_states.SAVE_FAILED || (needsSave() && <>&nbsp;*</>)}
                </>
              }
            />

            <Button type='text' size='l' onClick={safeNavigateToAsset} startIcon='close' />
          </bem.FormBuilderHeader__cell>
        </bem.FormBuilderHeader__row>

        <bem.FormBuilderHeader__row m={'secondary'}>
          <bem.FormBuilderHeader__cell m={'toolsButtons'}>
            <Button
              type='text'
              size='m'
              isDisabled={previewDisabled}
              onClick={previewForm}
              tooltip={t('Preview form')}
              tooltipPosition='left'
              startIcon='view'
            />

            <Button
              type='text'
              size='m'
              isDisabled={!showAllAvailable}
              onClick={showAll}
              tooltip={t('Expand / collapse questions')}
              tooltipPosition='left'
              startIcon='view-all'
            />

            <Button
              type='text'
              size='m'
              isDisabled={!groupable}
              onClick={groupQuestions}
              tooltip={
                groupable
                  ? t('Create group with selected questions')
                  : t('Grouping disabled. Please select at least one question.')
              }
              tooltipPosition='left'
              startIcon='group'
              className={cx({
                [LOCKING_UI_CLASSNAMES.DISABLED]: isAddingGroupsRestricted(),
              })}
            />

            <Button
              type='text'
              size='m'
              isDisabled={toggleCascade === undefined}
              onClick={toggleCascade}
              tooltip={t('Insert cascading select')}
              tooltipPosition='left'
              startIcon='cascading'
              className={cx({
                [LOCKING_UI_CLASSNAMES.DISABLED]: isAddingGroupsRestricted(),
              })}
            />
          </bem.FormBuilderHeader__cell>

          <bem.FormBuilderHeader__cell m='verticalRule' />

          <bem.FormBuilderHeader__cell m='spacer' />

          <bem.FormBuilderHeader__cell m='verticalRule' />

          <bem.FormBuilderHeader__cell>
            <Button
              type='text'
              size='m'
              onClick={toggleAsideLibrarySearch}
              tooltip={t('Add an item from the library')}
              tooltipPosition='left'
              startIcon={state.asideLibrarySearchVisible ? 'close' : 'library'}
              label={t('Add from Library')}
            />
          </bem.FormBuilderHeader__cell>

          <bem.FormBuilderHeader__cell m={'verticalRule'} />

          <bem.FormBuilderHeader__cell>
            <Button
              type='text'
              size='m'
              onClick={toggleAsideLayoutSettings}
              tooltip={hasMetadataAndDetails() ? t('Change form layout and settings') : t('Change form layout')}
              tooltipPosition='left'
              startIcon={state.asideLayoutSettingsVisible ? 'close' : 'settings'}
              label={hasMetadataAndDetails() ? t('Layout & Settings') : t('Layout')}
            />
          </bem.FormBuilderHeader__cell>
        </bem.FormBuilderHeader__row>
      </bem.FormBuilderHeader>
    )
  }

  function renderBackgroundAudioWarning() {
    if (state.isBackgroundAudioBannerDismissed) return null
    let bannerText = t(
      'This form will automatically [record audio in the background](##SUPPORT_LINK##). Consider adding with a meaningful consent question to inform respondents or data collectors that they will be recorded while completing this survey.',
    )

    if (envStore.isReady && envStore.data.support_url) {
      bannerText = bannerText.replace('##SUPPORT_LINK##', envStore.data.support_url + RECORDING_SUPPORT_URL)
    } else {
      // Replaces the link for the text only if link is not available
      bannerText = bannerText.replace(/\[(.+)]\(##SUPPORT_LINK##\)/, '$1')
    }

    return (
      <Alert
        type='info'
        iconName='information'
        p='sm'
        maw={1024}
        mb='sm'
        m='auto'
        closeButtonLabel={t('Dismiss')}
        onClose={() => {
          setState((currentState) => ({
            ...currentState,
            isBackgroundAudioBannerDismissed: true,
          }))
        }}
        withCloseButton
      >
        <Markdown
          components={{
            // Custom link component to open link on target _blank
            a: (props) => (
              <a href={props.href} target='_blank'>
                {props.children}
              </a>
            ),
            // Custom paragraph component to use mantine Text instead of <p>
            p: (props) => (
              <Text c='blue.4' mr='lg'>
                {props.children}
              </Text>
            ),
          }}
        >
          {bannerText}
        </Markdown>
      </Alert>
    )
  }

  function renderAside() {
    const { styleValue, hasSettings } = buttonStates()

    const isAsideVisible = state.asideLayoutSettingsVisible || state.asideLibrarySearchVisible

    return (
      <bem.FormBuilderAside m={isAsideVisible ? 'visible' : null}>
        {state.asideLayoutSettingsVisible && (
          <bem.FormBuilderAside__content>
            <bem.FormBuilderAside__row>
              <bem.FormBuilderAside__header>
                {t('Form style')}

                {envStore.isReady && envStore.data.support_url && (
                  <a
                    href={envStore.data.support_url + WEBFORM_STYLES_SUPPORT_URL}
                    target='_blank'
                    data-tip={t('Read more about form styles')}
                  >
                    <i className='k-icon k-icon-help' />
                  </a>
                )}
              </bem.FormBuilderAside__header>

              <label className='kobo-select__label' htmlFor='webform-style'>
                {hasSettings
                  ? t('Select the form style that you would like to use. This will only affect web forms.')
                  : t(
                      'Select the form style. This will only affect the Enketo preview, and it will not be saved with the question or block.',
                    )}
              </label>

              <Select
                className='kobo-select'
                classNamePrefix='kobo-select'
                id='webform-style'
                name='webform-style'
                value={getStyleSelectVal(styleValue)}
                onChange={onStyleChange}
                placeholder={AVAILABLE_FORM_STYLES[0].label}
                options={AVAILABLE_FORM_STYLES}
                menuPlacement='bottom'
                isDisabled={isChangingAppearanceRestricted()}
                isSearchable={false}
              />
            </bem.FormBuilderAside__row>

            {hasMetadataAndDetails() && (
              <bem.FormBuilderAside__row>
                <bem.FormBuilderAside__header>{t('Metadata')}</bem.FormBuilderAside__header>

                <MetadataEditor
                  survey={app?.survey}
                  onChange={onMetadataEditorChange}
                  isDisabled={isChangingMetaQuestionsRestricted()}
                  {...state}
                />
              </bem.FormBuilderAside__row>
            )}
          </bem.FormBuilderAside__content>
        )}

        {state.asideLibrarySearchVisible && (
          <bem.FormBuilderAside__content
            className={isAddingQuestionsRestricted() ? LOCKING_UI_CLASSNAMES.DISABLED : ''}
          >
            <bem.FormBuilderAside__row>
              <bem.FormBuilderAside__header>{t('Search Library')}</bem.FormBuilderAside__header>
            </bem.FormBuilderAside__row>

            <bem.FormBuilderAside__row>
              <AssetNavigator />
            </bem.FormBuilderAside__row>
          </bem.FormBuilderAside__content>
        )}
      </bem.FormBuilderAside>
    )
  }

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

  function renderAssetLabel() {
    if (!state.asset) {
      return null
    }

    const assetTypeLabel = getFormBuilderAssetType(state.asset.asset_type, state.desiredAssetType)?.label || 'asset'

    // Case 1: there is no asset yet (creting a new) or asset is not locked
    if (!state.asset?.content || !hasAssetAnyLocking(state.asset.content)) {
      return assetTypeLabel
      // Case 2: asset is locked fully or partially
    } else {
      let lockedLabel = t('Partially locked ##type##').replace('##type##', assetTypeLabel)
      if (isAssetAllLocked(state.asset.content)) {
        lockedLabel = t('Fully locked ##type##').replace('##type##', assetTypeLabel)
      }
      return (
        <span className='locked-asset-type-label'>
          <i className='k-icon k-icon-lock' />

          {lockedLabel}

          {envStore.isReady && envStore.data.support_url && (
            <a
              href={envStore.data.support_url + LOCKING_SUPPORT_URL}
              target='_blank'
              data-tip={t('Read more about Locking')}
            >
              <i className='k-icon k-icon-help' />
            </a>
          )}
        </span>
      )
    }
  }

  function toggleCascade() {
    var lastSelectedRow = last(app?.selectedRows()),
      lastSelectedRowIndex = lastSelectedRow ? app?.survey.rows.indexOf(lastSelectedRow) : -1

    setState((currentState) => ({
      ...currentState,
      showCascadePopup: !state.showCascadePopup,
      cascadeTextareaValue: '',
      cascadeLastSelectedRowIndex: lastSelectedRowIndex,
    }))
  }

  function cancelCascade() {
    setState((currentState) => ({
      ...currentState,
      cascadeReady: false,
      cascadeReadySurvey: undefined,
      cascadeTextareaValue: '',
      showCascadePopup: false,
    }))
  }

  function cascadePopupChange() {
    const cascadeEl = cascadeRef.current

    if (cascadeEl === null) {
      return
    }

    const textareaEl = cascadeEl as HTMLTextAreaElement

    var s: Partial<EditableFormState> & Pick<EditableFormState, 'cascadeTextareaValue'> = {
      cascadeTextareaValue: textareaEl.value,
    }
    // if (s.cascadeTextareaValue.length === 0) {
    //   return cancelCascade();
    // }
    try {
      var inp = dkobo_xlform.model.utils.split_paste(s.cascadeTextareaValue)
      var tmpSurvey = new dkobo_xlform.model.Survey({
        survey: [],
        choices: inp,
      })
      if (tmpSurvey.choices.length === 0) {
        throw new Error(
          // this message is presented to the user
          t('Paste your formatted table from excel in the box below.'),
        )
      }
      tmpSurvey.choices.at(0).create_corresponding_rows()
      /*
      tmpSurvey._addGroup({
        __rows: tmpSurvey.rows.models,
        label: '',
      });
      */
      var rowCount = tmpSurvey.rows.length
      if (rowCount === 0) {
        throw new Error(
          // this message is presented to the user
          t('Paste your formatted table from excel in the box below.'),
        )
      }
      s.cascadeReady = true
      s.cascadeReadySurvey = tmpSurvey
      s.cascadeMessage = {
        msgType: 'ready',
        addCascadeMessage: t('add cascade with # questions').replace('#', rowCount.toString()),
      }
    } catch (err) {
      const errObject = (err as unknown as { message?: string }) || {}
      s.cascadeReady = false
      s.cascadeMessage = {
        msgType: 'warning',
        message: errObject.message,
      }
    }
    setState((currentState) => ({
      ...currentState,
      ...s,
    }))
  }

  function renderCascadePopup() {
    return (
      <bem.CascadePopup>
        {state.cascadeMessage ? (
          <bem.CascadePopup__message m={state.cascadeMessage.msgType}>
            {state.cascadeMessage.message}
          </bem.CascadePopup__message>
        ) : (
          <bem.CascadePopup__message m='instructions'>
            {t('Paste your formatted table from excel in the box below.')}
          </bem.CascadePopup__message>
        )}

        {state.cascadeReady ? <bem.CascadePopup__message m='ready'>{t('OK')}</bem.CascadePopup__message> : null}

        <textarea ref={cascadeRef} onChange={cascadePopupChange} value={state.cascadeTextareaValue} />

        {envStore.isReady && envStore.data.support_url && (
          <div className='cascade-help right-tooltip'>
            <a
              href={envStore.data.support_url + CHOICE_LIST_SUPPORT_URL}
              target='_blank'
              data-tip={t('Learn more about importing cascading lists from Excel')}
            >
              <i className='k-icon k-icon-help' />
            </a>
          </div>
        )}

        <bem.CascadePopup__buttonWrapper>
          <Button
            type='primary'
            size='l'
            isDisabled={!state.cascadeReady}
            onClick={() => {
              if (state.cascadeReadySurvey) {
                app?.survey?.insertSurvey(state.cascadeReadySurvey, state.cascadeLastSelectedRowIndex)
                cancelCascade()
              }
            }}
            label={t('DONE')}
          />
        </bem.CascadePopup__buttonWrapper>
      </bem.CascadePopup>
    )
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
        {
          /*
            TODO: Try to fix quirks that arise from this <Prompt/> usage
            Issue: https://github.com/kobotoolbox/kpi/issues/4154
          */
          state.preventNavigatingOut && <Prompt />
        }
        <div className='form-builder-wrapper'>
          {renderAside()}

          <bem.FormBuilder>
            {renderFormBuilderHeader()}

            <bem.FormBuilder__contents>
              {state.asset && <FormLockedMessage asset={state.asset} />}

              {hasBackgroundAudio() && renderBackgroundAudioWarning()}

              <div ref={formWrapRef} className='form-wrap'>
                {!state.surveyAppRendered && renderNotLoadedMessage()}
              </div>
            </bem.FormBuilder__contents>
          </bem.FormBuilder>

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

          {state.showCascadePopup && (
            <Modal open onClose={hideCascade} title={t('Import Cascading Select Questions')}>
              <Modal.Body>{renderCascadePopup()}</Modal.Body>
            </Modal>
          )}
        </div>
      </>
    </DocumentTitle>
  )
}
