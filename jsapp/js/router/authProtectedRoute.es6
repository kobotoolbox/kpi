import React, {Suspense} from 'react';
import sessionStore from 'js/components/account/sessionStore';
import AccessDenied from 'js/router/accessDenied';

/**
 * A gateway component for rendering the route only for authorized user.
 *
 * NOTE: we assume sessionStore is already initialized because of
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
    if (sessionStore.isLoggedIn) {
      return <Suspense fallback={null}>
        <this.props.route.protectedComponent {...this.props}/>;
        </Suspense>
    }
    return <AccessDenied/>;
  }
}
