import React from 'react';
import {stores} from 'js/stores';
import AccessDenied from 'js/router/accessDenied';

/**
 * A generic component for rendering the route only for a user who has permission to view it.
 *
 * NOTE: we assume stores.session is already initialized because of
 * a conditional statement in `allRoutes`.
 *
 * @prop {string} path - one of PATHS
 * @prop {object} route
 * @prop {object} route.unlockComponent - the target route commponent that should be displayed for authenticateed user
 */
export default class PermProtectedRoute extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    if (stores.session.isLoggedIn) {
      return <this.props.route.unlockComponent/>;
    }
    return <AccessDenied/>;
  }
}
