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
      actions.resources.createResource.triggerAsync({
        asset_type: 'question',
        content: JSON.stringify({
          survey: [
            row.toJSON2()
          ]
        })
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
