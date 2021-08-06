import React from 'react';
import autoBind from 'react-autobind';
import {stores} from 'js/stores';
import {actions} from 'js/actions';
import permConfig from 'js/components/permissions/permConfig';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import AccessDenied from 'js/router/accessDenied';

/**
 * A generic component for rendering the route only for a user who has
 * permission to view it. Should be used only for asset routes.
 *
 * NOTE: we assume stores.session is already initialized because of
 * a conditional statement in `allRoutes`.
 *
 * @prop {string} path - one of PATHS
 * @prop {object} route
 * @prop {object} route.protectedComponent - the target route commponent that should be displayed for authenticateed user
 * @prop {object} route.requiredPermission - the permission needed to be able to see the route
 */
export default class PermProtectedRoute extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isAssetReady: false,
      isAssetExisting: null,
      userHasPermission: null,
    };
    autoBind(this);
  }

  componentDidMount() {
    actions.resources.loadAsset.completed.listen(this.onLoadAssetCompleted);
    actions.resources.loadAsset.failed.listen(this.onLoadAssetFailed);
    actions.resources.loadAsset({id: this.props.params.uid});
  }

  onLoadAssetCompleted(asset) {
    let userHasPermission = false;
    const userViewAssetPerm = asset.permissions.find((perm) => {
      // Get permissions url related to current user
      const permUserUrl = perm.user.split('/');
      return (
        permUserUrl[permUserUrl.length - 2] === stores.session.currentAccount.username &&
        perm.permission === permConfig.getPermissionByCodename(this.props.route.protectedComponent).url
      );
    });
    if (userViewAssetPerm !== 'unedfined') {
      userHasPermission = true;
    }

    this.setState({
      isAssetReady: true,
      userHasPermission: userHasPermission,
    });
  }

  onLoadAssetFailed(response) {
    if (response.status === 404) {
      this.setState({
        isAssetReady: true,
      });
    }
  }

  render() {
    if (!this.state.isAssetReady) {
      return (<LoadingSpinner/>);
    } else if (this.state.userHasPermission) {
      return <this.props.route.protectedComponent {...this.props.params}/>;
    } else {
      return <AccessDenied/>;
    }
  }
}
