import {browserHistory} from 'react-router';
import {
  customConfirmAsync,
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
      browserHistory.push('/library');
    } else {
      customConfirmAsync(t('you have unsaved changes. leave form without saving?'))
        .done(() => {
          browserHistory.push('/library');
        });
    }
  },
};
