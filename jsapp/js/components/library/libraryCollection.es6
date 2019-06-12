import React from 'react';
import PropTypes from 'prop-types';
import autoBind from 'react-autobind';
import bem from 'js/bem';
import {t} from 'js/utils';

class LibraryCollection extends React.Component {
  constructor(props) {
    super(props);
    autoBind(this);
  }

  render () {
    return (
      <bem.Library>
        {t('Library Collection')}
      </bem.Library>
      );
  }
}

LibraryCollection.contextTypes = {
  router: PropTypes.object
};

export default LibraryCollection;
