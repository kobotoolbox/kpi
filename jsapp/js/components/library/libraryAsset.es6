import React from 'react';
import PropTypes from 'prop-types';
import autoBind from 'react-autobind';
import reactMixin from 'react-mixin';
import Reflux from 'reflux';
import bem from 'js/bem';
import mixins from 'js/mixins';
import stores from 'js/stores';
import actions from 'js/actions';
import {t} from 'js/utils';

class LibraryAsset extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      asset: false
    };
    autoBind(this);
  }

  componentDidMount() {
    this.listenTo(stores.asset, this.onAssetLoad);

    const uid = this.currentAssetID();
    if (uid) {
      actions.resources.loadAsset({id: uid});
    }
  }

  onAssetLoad(data) {
    const uid = this.currentAssetID();
    const asset = data[uid];
    if (asset) {
      this.setState({asset: asset});
    }
  }

  render () {
    return (
      <bem.Library>
        {t('Library Asset')}
      </bem.Library>
      );
  }
}

reactMixin(LibraryAsset.prototype, mixins.contextRouter);
reactMixin(LibraryAsset.prototype, Reflux.ListenerMixin);

LibraryAsset.contextTypes = {
  router: PropTypes.object
};

export default LibraryAsset;
