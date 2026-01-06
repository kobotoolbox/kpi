import findIndex from 'lodash.findindex'
import isEmpty from 'lodash.isempty'
import map from 'lodash.map'
import { unnullifyTranslations } from '#/components/formBuilder/formBuilderUtils'
import { ASSET_TYPES, type AssetTypeDefinition, CHOICE_LISTS, QUESTION_TYPES } from '#/constants'
import type { AssetContent } from '#/dataInterface'
import { notify } from '#/utils'
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

  constructor(params: { survey: Survey; rawSurvey?: AssetContent; assetType: AssetTypeDefinition | null }) {
    this.survey = params.survey
    this.rawSurvey = params.rawSurvey
    this.assetType = params.assetType
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
          [QUESTION_TYPES.select_one.id, QUESTION_TYPES.select_multiple.id].indexOf(content.type) > -1 &&
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

  handleItem(data: { position: number; itemUid: string; groupId?: string }) {
    if (!data.itemUid) {
      throw new Error('itemUid not provided!')
    }

    actions.survey.addExternalItemAtPosition({
      position: data.position,
      uid: data.itemUid,
      survey: this.survey,
      groupId: data.groupId,
    })
  }
}

export default SurveyScope
