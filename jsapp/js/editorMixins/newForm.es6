import {
  customConfirmAsync,
  // log,
  t,
} from '../utils';

import dkobo_xlform from '../../xlform/src/_xlform.init';

export default {
  editorState: 'new',
  getInitialState () {
    return {
      kind: 'asset',
      asset: false
    };
  },
  componentDidMount () {
      var survey;
      if (this.listRoute == 'library') {
        survey = dkobo_xlform.model.Survey.loadDict({survey: []});
      } else {
        survey = dkobo_xlform.model.Survey.create();
      }
      this.launchAppForSurvey(survey);
  },
  navigateBack () {
    if (!this.needsSave()) {
      this.transitionTo(this.listRoute);
    } else {
      customConfirmAsync(t('you have unsaved changes. would you like to save?'))
        .fail(() => {
          this.transitionTo(this.listRoute);
        });
    }
  },
};
