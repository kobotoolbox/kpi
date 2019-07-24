import React from 'react';
import PropTypes from 'prop-types';
import autoBind from 'react-autobind';
import stores from 'js/stores';
import bem from 'js/bem';
import {t} from 'js/utils';
import {MODAL_TYPES} from 'js/constants';

class LibraryCollection extends React.Component {
  constructor(props) {
    super(props);
    autoBind(this);
  }

  showSharingModal(evt) {
    evt.preventDefault();
    stores.pageState.showModal({
      type: MODAL_TYPES.SHARING,
      assetid: this.props.params.uid
    });
  }

  render() {
    return (
      <bem.Library>
        {t('Library Collection')}

        <button onClick={this.showSharingModal.bind(this)}>
          share
        </button>
      </bem.Library>
      );
  }
}

LibraryCollection.contextTypes = {
  router: PropTypes.object
};

export default LibraryCollection;
