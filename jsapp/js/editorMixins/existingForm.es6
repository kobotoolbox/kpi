import React from 'react';
import mixins from '../mixins';
import {hashHistory} from 'react-router';

import {
  t,
  log,
  customConfirmAsync
} from '../utils';

import stores from '../stores';

export default {
  editorState: 'existing',
  contextTypes: {
    router: React.PropTypes.object
  },
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
    var path = `/forms/${this.state.asset_uid}`;
    if (this.context.router.isActive('library'))
      path = '/library';

    if (!this.needsSave()) {
      hashHistory.push(path);
    } else {
      customConfirmAsync(t('you have unsaved changes. leave form without saving?'))
        .done(() => {
          hashHistory.push(path);
        });
    }
  },
};
