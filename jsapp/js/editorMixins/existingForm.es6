import {
  t,
  log,
  customConfirmAsync,
  isLibrary,
} from '../utils';

import stores from '../stores';

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
    var routeName = 'forms';
    var params = {};
    if (isLibrary(this.context.router)) {
      routeName = 'library';
    } else {
      if (stores.history.previousRoute == 'form-landing') {
        routeName = 'form-landing';
        params = {assetid: this.props.params.assetid};
      }
    }

    if (!this.needsSave()) {
      this.transitionTo(routeName, params);
    } else {
      customConfirmAsync(t('you have unsaved changes. leave form without saving?'))
        .done(() => {
          this.transitionTo(routeName, params);
        });
    }
  },
};
