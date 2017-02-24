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
      let translations = (asset.content && asset.content.translations
                          && asset.content.translations.slice(0)) || [];
      this.launchAppForSurveyContent(asset.content, {
        name: asset.name,
        translations: translations,
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
      if (stores.history.currentRoute === 'form-edit') {
        routeName = 'form-landing';
        params = {
          assetid: this.props.params.assetid,
        };
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
