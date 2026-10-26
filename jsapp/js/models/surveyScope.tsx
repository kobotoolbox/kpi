import clonedeep from 'lodash.clonedeep'
import findIndex from 'lodash.findindex'
import isEmpty from 'lodash.isempty'
import map from 'lodash.map'
import { assetsRetrieve } from '#/api/react-query/manage-projects-and-library-content'
import { openImportLanguagesModal } from '#/components/formBuilder/ImportLanguagesModals/openImportLanguagesModal'
import { unnullifyTranslations } from '#/components/formBuilder/formBuilderUtils'
import {
  discardAssetLanguages,
  getFormLanguages,
  resolveImportLanguages,
} from '#/components/formBuilder/importLanguages'
import { ASSET_TYPES, type AssetTypeDefinition, CHOICE_LISTS, QUESTION_TYPES } from '#/constants'
import type { AssetContent } from '#/dataInterface'
import { notify } from '#/utils'
import dkobo_xlform from '../../xlform/src/_xlform.init'
import type { BaseRow, Row } from '../../xlform/src/model.row'
import type { FlatChoice, FlatRow, FlatSurvey, Survey } from '../../xlform/src/model.survey'
import type { Group } from '../../xlform/src/model.surveyFragment'
import { actions } from '../actions'

class SurveyScope {
  survey: Survey
  // SurveyScope is being passed on in some Form Builder code. We don't use `rawSurvey` or `assetType` here directly, but
  // some code expects it to be here.
  rawSurvey?: AssetContent
  assetType: AssetTypeDefinition | null
  /** Takes the user to where languages are edited. The Form Builder owns the router and the unsaved-changes guard. */
  onManageLanguages?: () => void

  constructor(params: {
    survey: Survey
    rawSurvey?: AssetContent
    assetType: AssetTypeDefinition | null
    onManageLanguages?: () => void
  }) {
    this.survey = params.survey
    this.rawSurvey = params.rawSurvey
    this.assetType = params.assetType
    this.onManageLanguages = params.onManageLanguages
  }

  addItemToLibrary(row: Row | Group, assetContent: AssetContent) {
    const surv = this.survey.toFlatJSON()
    /*
     * Apply translations "hack" again for saving single questions to library
     * Since `unnullifyTranslations` requires the whole survey, we need to
     * fish out the saved row and its translation settings out of the unnullified return
     */
    const unnullifiedContent = JSON.parse(unnullifyTranslations(JSON.stringify(surv), assetContent))

    if ((row.constructor as typeof BaseRow).kls === 'Row') {
      this.addQuestionToLibrary(row, unnullifiedContent)
    } else {
      this.addGroupToLibrary(row, unnullifiedContent)
    }
  }

  addQuestionToLibrary(row: Row | Group, unnullifiedContent: FlatSurvey) {
    const rowJSON = row.toJSON2()

    const question = unnullifiedContent.survey.find((s) => s.$kuid === rowJSON.$kuid)

    let choices
    if (rowJSON.type === QUESTION_TYPES.select_one.id || rowJSON.type === QUESTION_TYPES.select_multiple.id) {
      choices = unnullifiedContent.choices?.filter((s) => s.list_name === rowJSON.select_from_list_name)
    }

    const content = JSON.stringify({
      survey: [question],
      choices, // included only if question is select_one or select_multiple
      settings: unnullifiedContent.settings,
    })

    actions.resources.createResource
      .triggerAsync({
        asset_type: ASSET_TYPES.question.id,
        content: content,
      })
      .then(() => {
        notify(t('question has been added to the library'))
      })
  }

  addGroupToLibrary(row: Row | Group, unnullifiedContent: FlatSurvey) {
    let contents: FlatRow[] = []
    let choices: FlatChoice[] = []
    const groupKuid = row.toJSON2().$kuid

    if (!isEmpty(unnullifiedContent.survey)) {
      const startGroupIndexFound = findIndex(unnullifiedContent.survey, (content) => content['$kuid'] === groupKuid)
      if (startGroupIndexFound > -1) {
        const endGroupIndexFound = findIndex(
          unnullifiedContent.survey,
          (content) => content['$kuid'] === '/' + groupKuid,
        )
        contents = unnullifiedContent.survey.slice(startGroupIndexFound, endGroupIndexFound + 1)
      }
    }

    if (contents.length > 0) {
      const contents_kuids = map(contents, '$kuid')
      const selectSurveyContents = unnullifiedContent.survey.filter(
        (content) =>
          (content.type === QUESTION_TYPES.select_one.id || content.type === QUESTION_TYPES.select_multiple.id) &&
          contents_kuids.indexOf(content['$kuid']) > -1,
      )
      if (selectSurveyContents.length > 0) {
        const selectListNames = map(selectSurveyContents, CHOICE_LISTS.SELECT)
        choices = unnullifiedContent.choices?.filter((choice) => selectListNames.indexOf(choice.list_name) > -1) || []
      }
    }

    const content = JSON.stringify({
      survey: contents,
      choices: choices,
      settings: unnullifiedContent.settings,
    })

    actions.resources.createResource
      .triggerAsync({
        asset_type: ASSET_TYPES.block.id,
        content: content,
        name: row.get('label').get('value') || row.get('name').get('value'),
      })
      .then(() => {
        notify(t('group has been added to the library as a block'))
      })
  }

  /**
   * Fetches a library asset and inserts it into the form.
   *
   * The asset can be a single question or a group containing multiple questions.
   * For select questions, insertSurvey() will call _ensure_row_list_is_copied()
   * to give each instance its own choice list.
   *
   * Languages are resolved here, before anything is inserted - the only place an import can still be called off.
   *
   * Never rejects: a failed fetch or a bad asset is reported as a notification.
   *
   * @param position - Where to insert (0-based)
   * @param uid - Library asset UID
   * @param groupId - Target group CID (omit for survey root)
   */
  async addExternalItemAtPosition(position: number, uid: string, groupId?: string): Promise<void> {
    try {
      const response = await assetsRetrieve(uid)
      const data = response?.data

      if (!(data && 'content' in data && data.content)) {
        throw new Error(`Asset ${uid} not found or response missing content`)
      }

      // Cloned up front because both `discardAssetLanguages` and `Survey.loadDict` mutate what they are given
      const content = clonedeep(data.content) as AssetContent
      const resolution = resolveImportLanguages(getFormLanguages(this.survey._initialParams), content.translations)

      if (resolution.action !== 'merge') {
        const choice = await openImportLanguagesModal(resolution)

        if (choice === 'manage-languages') {
          this.onManageLanguages?.()
          return
        }

        if (choice === 'cancel') {
          return
        }

        if (choice === 'discard' && resolution.action === 'add-or-discard') {
          discardAssetLanguages(content, resolution.languagesToAdd)
        }
      }

      const newSurvey = dkobo_xlform.model.Survey.loadDict(content, this.survey)
      // TODO: Race condition - the survey can change while we wait for the fetch or the user's answer, so this may
      // insert at the wrong position or into a group that is gone
      this.survey.insertSurvey(newSurvey, position, groupId)
    } catch (error) {
      console.error('Failed to insert external item into survey:', error)
      notify(t('Failed to insert item from library'), 'error')
    }
  }

  /**
   * Handles library items dropped into FormBuilder.
   * Called by the sortable receive handlers in view.surveyApp.coffee.
   *
   * @param data.position - Where to insert (0-based index)
   * @param data.itemUid - Library asset UID
   * @param data.groupId - Target group CID (omit to insert at survey root)
   * @throws Error if itemUid is missing
   */
  handleItem(data: { position: number; itemUid: string; groupId?: string }): void {
    if (!data.itemUid) {
      throw new Error('addExternalItemAtPosition: itemUid not provided!')
    }

    this.addExternalItemAtPosition(data.position, data.itemUid, data.groupId)
  }
}

export default SurveyScope
