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
      this.launchAppForSurveyContent(asset.content, {
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
      customConfirmAsync(t('you have unsaved changes. leave form without saving?'))
        .done(() => {
          this.transitionTo('form-landing', {assetid: this.props.params.assetid});
        });
    }
  },
};
