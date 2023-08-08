import React from 'react';
import {observer} from 'mobx-react';
import autoBind from 'react-autobind';
import {RouterProvider} from 'react-router-dom';
import {actions} from 'js/actions';
import permConfig from 'js/components/permissions/permConfig';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import {isRootRoute, redirectToLogin} from 'js/router/routerUtils';
import sessionStore from 'js/stores/session';
import router from './router';

const AllRoutes = class AllRoutes extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isPermsConfigReady: permConfig.isReady(),
    };
    autoBind(this);
  }

  componentDidMount() {
    actions.permissions.getConfig.completed.listen(
      this.onGetConfigCompleted.bind(this)
    );
    actions.permissions.getConfig();
  }

  onGetConfigCompleted(response) {
    permConfig.setPermissions(response.results);
    this.setReady({isPermsConfigReady: permConfig.isReady()});
  }

  /**
   * This convoluted function wants to check if redirect should be made before
   * setting the state - which would cause an unwanted rerender.
   *
   * @param {object} data
   * @param {boolean} [data.isPermsConfigReady]
   * @param {boolean} [data.isSessionReady]
   */
  setReady(data) {
    const newStateObj = {
      isPermsConfigReady: this.state.isPermsConfigReady,
      isSessionReady: this.state.isSessionReady,
    };

    if (typeof data.isPermsConfigReady !== 'undefined') {
      newStateObj.isPermsConfigReady = data.isPermsConfigReady;
    }

    if (typeof data.isSessionReady !== 'undefined') {
      newStateObj.isSessionReady = data.isSessionReady;
    }

    if (
      !(
        newStateObj.isPermsConfigReady &&
        newStateObj.isSessionReady &&
        !sessionStore.isLoggedIn &&
        isRootRoute()
      )
    ) {
      this.setState(newStateObj);
    }
  }

  render() {
    // This is the place that stops any app rendering until all necessary
    // backend calls are done.
    if (!this.state.isPermsConfigReady || !sessionStore.isAuthStateKnown) {
      return <LoadingSpinner />;
    }

    // If all necessary data is obtained, and user is not logged in, and on
    // the root route, redirect immediately to the login page outside
    // the React app, and skip setting the state (so no content blink).
    if (!sessionStore.isLoggedIn && isRootRoute()) {
      redirectToLogin();
      // redirect is async, continue showing loading
      return <LoadingSpinner />;
    }

    return <RouterProvider router={router} />;
  }
};

export default observer(AllRoutes);
