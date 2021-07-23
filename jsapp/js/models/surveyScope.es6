import {actions} from '../actions';
import {notify} from 'utils';
import {unnullifyTranslations} from 'js/components/formBuilder/formBuilderUtils';

class SurveyScope {
  constructor ({survey, rawSurvey, assetType}) {
    this.survey = survey;
    this.rawSurvey = rawSurvey;
    this.assetType = assetType;
  }
  add_row_to_question_library (row, assetContent) {
    if (row.constructor.kls === 'Row') {
      var rowJSON = row.toJSON2();
      let content;
      var surv = this.survey.toFlatJSON();
      /*
       * Apply translations "hack" again for saving single questions to library
       * Since `unnullifyTranslations` requires the whole survey, we need to
       * fish out the saved row and its translation settings out of the unnullified return
       */
      var unnullifiedContent = JSON.parse(unnullifyTranslations(JSON.stringify(surv), assetContent));
      var settingsObj = unnullifiedContent.settings;
      var surveyObj = unnullifiedContent.survey;
      if (rowJSON.type === 'select_one' || rowJSON.type === 'select_multiple') {
        var choices = unnullifiedContent.choices.filter(s => s.list_name === rowJSON.select_from_list_name);
        for (var i in surveyObj) {
          if (surveyObj[i].$kuid == row.toJSON2().$kuid) {
            content = JSON.stringify({
              survey: [
                surveyObj[i]
              ],
              choices: choices,
              settings: settingsObj
            });
          }
        }
      } else {
        for (var j in surveyObj) {
          if (surveyObj[j].$kuid == row.toJSON2().$kuid) {
            content = JSON.stringify({
              survey: [
                surveyObj[j]
              ],
              choices: choices,
              settings: settingsObj
            });
          }
        }
      }
      actions.resources.createResource.triggerAsync({
        asset_type: 'question',
        content: content
      }).then(function(){
        notify(t('question has been added to the library'));
      });
    } else {
      console.error('cannot add group to question library');
    }
  }
  handleItem({position, itemUid, groupId}) {
    if (!itemUid) {
      throw new Error('itemUid not provided!');
    }

    actions.survey.addExternalItemAtPosition({
      position: position,
      uid: itemUid,
      survey: this.survey,
      groupId: groupId
    });
  }
}

export default SurveyScope;
