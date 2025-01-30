import isEmpty from 'lodash.isempty';
import findIndex from 'lodash.findindex';
import map from 'lodash.map';
import {actions} from '../actions';
import {
  ASSET_TYPES,
  QUESTION_TYPES,
  CHOICE_LISTS,
} from 'js/constants';
import {notify} from 'utils';
import {unnullifyTranslations} from 'js/components/formBuilder/formBuilderUtils';

class SurveyScope {
  constructor ({survey, rawSurvey, assetType}) {
    this.survey = survey;
    this.rawSurvey = rawSurvey;
    this.assetType = assetType;
  }

  addItemToLibrary(row, assetContent) {
    const surv = this.survey.toFlatJSON();
    /*
     * Apply translations "hack" again for saving single questions to library
     * Since `unnullifyTranslations` requires the whole survey, we need to
     * fish out the saved row and its translation settings out of the unnullified return
     */
    const unnullifiedContent = JSON.parse(unnullifyTranslations(JSON.stringify(surv), assetContent));

    if (row.constructor.kls === 'Row') {
      this.addQuestionToLibrary(row, unnullifiedContent);
    } else {
      this.addGroupToLibrary(row, unnullifiedContent);
    }
  }

  addQuestionToLibrary(row, unnullifiedContent) {
    const rowJSON = row.toJSON2();

    const question = unnullifiedContent.survey.find((s) =>
      s.$kuid === rowJSON.$kuid
    );

    let choices;
    if (
      rowJSON.type === QUESTION_TYPES.select_one.id ||
      rowJSON.type === QUESTION_TYPES.select_multiple.id
    ) {
      choices = unnullifiedContent.choices.filter((s) =>
        s.list_name === rowJSON.select_from_list_name
      );
    }

    const content = JSON.stringify({
      survey: [question],
      choices, // included only if question is select_one or select_multiple
      settings: unnullifiedContent.settings,
    });

    actions.resources.createResource.triggerAsync({
      asset_type: ASSET_TYPES.question.id,
      content: content,
    }).then(() => {
      notify(t('question has been added to the library'));
    });
  }

  addGroupToLibrary(row, unnullifiedContent) {
    let contents = [];
    let choices = [];
    const groupKuid = row.toJSON2().$kuid;

    if (!isEmpty(unnullifiedContent.survey)) {
      const startGroupIndexFound = findIndex(unnullifiedContent.survey, (content) =>
        content['$kuid'] === groupKuid
      );
      if (startGroupIndexFound > -1) {
        const endGroupIndexFound = findIndex(unnullifiedContent.survey, (content) =>
          content['$kuid'] === '/' + groupKuid
        );
        contents = unnullifiedContent.survey.slice(startGroupIndexFound, endGroupIndexFound + 1);
      }
    }

    if (contents.length > 0) {
      const contents_kuids = map(contents, '$kuid');
      const selectSurveyContents = unnullifiedContent.survey.filter((content) =>
        [QUESTION_TYPES.select_one.id, QUESTION_TYPES.select_multiple.id].indexOf(content.type) > -1 &&
        contents_kuids.indexOf(content['$kuid']) > -1
      );
      if (selectSurveyContents.length > 0) {
        const selectListNames = map(selectSurveyContents, CHOICE_LISTS.SELECT);
        choices = unnullifiedContent.choices.filter((choice) =>
          selectListNames.indexOf(choice.list_name) > -1
        );
      }
    }

    const content = JSON.stringify({
      survey: contents,
      choices: choices,
      settings: unnullifiedContent.settings,
    });

    actions.resources.createResource.triggerAsync({
      asset_type: ASSET_TYPES.block.id,
      content: content,
      name: row.get('label').get('value') || row.get('name').get('value'),
    }).then(() => {
      notify(t('group has been added to the library as a block'));
    });
  }

  handleItem({position, itemUid, groupId}) {
    if (!itemUid) {
      throw new Error('itemUid not provided!');
    }

    actions.survey.addExternalItemAtPosition({
      position: position,
      uid: itemUid,
      survey: this.survey,
      groupId: groupId,
    });
  }
}

export default SurveyScope;
