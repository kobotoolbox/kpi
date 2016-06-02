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
    this.launchAppForSurveyContent(
        this.listRoute == 'library' ? {survey: []} : null
      );
  },
  navigateBack () {
    if (!this.needsSave()) {
      this.transitionTo(this.listRoute);
    } else {
      customConfirmAsync(t('you have unsaved changes. leave form without saving?'))
        .done(() => {
          this.transitionTo(this.listRoute);
        });
    }
  },
};
