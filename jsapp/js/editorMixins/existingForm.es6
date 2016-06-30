import {
  t,
  log,
  customConfirmAsync,
  isLibrary,
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
    var routeName = `${isLibrary(this.context.router) ? 'library-' : ''}form-landing`;
    if (!this.needsSave()) {
      this.transitionTo(routeName, {assetid: this.props.params.assetid});
    } else {
      customConfirmAsync(t('you have unsaved changes. leave form without saving?'))
        .done(() => {
          this.transitionTo(routeName, {assetid: this.props.params.assetid});
        });
    }
  },
};
