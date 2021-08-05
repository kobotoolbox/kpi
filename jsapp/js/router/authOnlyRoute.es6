import React from 'react';
import {stores} from 'js/stores';
import {bem} from 'js/bem';
import {MODAL_TYPES} from 'js/constants';

/**
 * A generic component for rendering the route only for authorized user.
 *
 * NOTE: we assume stores.session is already initialized because of
 * a conditional statement in `allRoutes`.
 *
 * @prop {string} path - one of PATHS
 * @prop {object} route
 * @prop {object} route.unlockComponent - the target route commponent that should be displayed for authenticateed user
 */
export default class AuthOnlyRoute extends React.Component {
  constructor(props) {
    super(props);
  }

  componentDidMount() {
    if (!stores.session.isLoggedIn) {
      // setTimeout(stores.pageState.showModal.bind(this, {type: MODAL_TYPES.ACCESS_DENIED}), 0);
      stores.pageState.showModal({type: MODAL_TYPES.ACCESS_DENIED});
    }
  }

  render() {
    if (stores.session.isLoggedIn) {
      return <this.props.route.unlockComponent/>;
    }
    return (
      <bem.Loading>
        <bem.Loading__inner>
          <i className='k-icon k-icon-lock-alt'/>
          {t('Access denied')}
        </bem.Loading__inner>
      </bem.Loading>
    );
  }
}
