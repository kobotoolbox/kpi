import React from 'react';
import PropTypes from 'prop-types';
import autoBind from 'react-autobind';
import {bem} from 'js/bem';
import {t} from 'js/utils';

class PublicCollectionsRoute extends React.Component {
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

PublicCollectionsRoute.contextTypes = {
  router: PropTypes.object
};

export default PublicCollectionsRoute;
