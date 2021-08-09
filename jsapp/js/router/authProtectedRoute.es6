import React from 'react';
import {stores} from 'js/stores';
import AccessDenied from 'js/router/accessDenied';

/**
 * A gateway component for rendering the route only for authorized user.
 *
 * NOTE: we assume stores.session is already initialized because of
 * a conditional statement in `allRoutes`.
 *
 * @prop {string} path - one of PATHS
 * @prop {object} route
 * @prop {object} route.protectedComponent - the target route commponent that should be displayed for authenticateed user
 */
export default class AuthProtectedRoute extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    if (stores.session.isLoggedIn) {
      return <this.props.route.protectedComponent {...this.props}/>;
    }
    return <AccessDenied/>;
  }
}
