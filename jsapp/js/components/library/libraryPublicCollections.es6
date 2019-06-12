import React from 'react';
import PropTypes from 'prop-types';
import autoBind from 'react-autobind';
import bem from 'js/bem';
import {t} from 'js/utils';

class LibraryPublicCollections extends React.Component {
  constructor(props) {
    super(props);
    autoBind(this);
  }

  render () {
    return (
      <bem.Library>
        {t('Public Collections')}
      </bem.Library>
      );
  }
}

LibraryPublicCollections.contextTypes = {
  router: PropTypes.object
};

export default LibraryPublicCollections;
