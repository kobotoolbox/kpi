import {
  t,
  log,
  customConfirmAsync,
} from '../utils';

import stores from '../stores';
import dkobo_xlform from '../../xlform/src/_xlform.init';

export default {
  editorState: 'existing',
  getInitialState () {
    return {
      kind: 'asset',
      asset: false
    };
  },
  componentDidMount () {
    let uid = this.props.params.assetid;
    stores.allAssets.whenLoaded(uid, (asset) => {
      var survey = dkobo_xlform.model.Survey.loadDict(asset.content);
      this.launchAppForSurvey(survey, {
        // alternatively, we could pass asset. But for now it would be nice to keep
        // track of the asset attributes used (and modified) in the UI
        name: asset.name,
        settings__style: asset.settings__style,
        asset_uid: asset.uid,
        asset_type: asset.asset_type,
      });
    });
  },
  navigateBack () {
    if (!this.needsSave()) {
      this.transitionTo('form-landing', {assetid: this.props.params.assetid});
    } else {
      customConfirmAsync(t('you have unsaved changes. would you like to save?'))
        .done(() => {
          this.saveForm();
        });
    }
  },
};
