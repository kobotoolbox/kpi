import actions from '../actions';
import {
  notify,
  t,
} from '../utils';

class SurveyScope {
  constructor ({survey}) {
    this.survey = survey;
  }
  add_row_to_question_library (row) {
    if (row.constructor.kls === 'Row') {
      var rowJSON = row.toJSON2();
      if (rowJSON.type === 'select_one' || rowJSON.type === 'select_multiple') {
        var surv = this.survey.toFlatJSON();
        var choices = surv.choices.filter(s => s.list_name === rowJSON.select_from_list_name);
        var content = JSON.stringify({
          survey: [
            row.toJSON2()
          ],
          choices: choices || undefined
        });
      } else {
        JSON.stringify({
          survey: [
            row.toJSON2()
          ]
        })
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
  handleItem({position, itemData}) {
    actions.survey.addItemAtPosition({position: position, uid: itemData.uid, survey: this.survey});
  }
}

export default SurveyScope;
