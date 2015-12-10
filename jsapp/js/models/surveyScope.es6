import actions from '../actions';

class SurveyScope {
  constructor ({survey}) {
    this.survey = survey;
  }
  add_row_to_question_library (row) {
    if (row.constructor.kls === 'Row') {
      actions.resources.createAsset({
        content: JSON.stringify({
          survey: [
            row.toJSON2()
          ]
        })
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
