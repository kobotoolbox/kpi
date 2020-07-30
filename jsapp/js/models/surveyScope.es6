import {actions} from '../actions';
import {
  notify,
  t,
  unnullifyTranslations,
} from '../utils';

class SurveyScope {
  constructor ({survey}) {
    this.survey = survey;
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
      var settings_obj = unnullifiedContent.settings;
      var survey_obj = unnullifiedContent.survey;
      if (rowJSON.type === 'select_one' || rowJSON.type === 'select_multiple') {
        var choices = unnullifiedContent.choices.filter(s => s.list_name === rowJSON.select_from_list_name);
        for (var i in survey_obj) {
          if (survey_obj[i].$kuid == row.toJSON2().$kuid) {
            content = JSON.stringify({
              survey: [
                survey_obj[i]
              ],
              choices: choices || undefined,
              settings: settings_obj || undefined
            });
          }
        }
      } else {
        for (var j in survey_obj) {
          if (survey_obj[j].$kuid == row.toJSON2().$kuid) {
            content = JSON.stringify({
              survey: [
                survey_obj[j]
              ],
              choices: choices || undefined,
              settings: settings_obj || undefined
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
