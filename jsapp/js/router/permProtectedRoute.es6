import React, {Suspense} from 'react';
import autoBind from 'react-autobind';
import {actions} from 'js/actions';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import AccessDenied from 'js/router/accessDenied';
import {withRouter} from './legacy';
import {userCan, userCanPartially} from 'js/components/permissions/utils';

/**
 * A gateway component for rendering the route only for a user who has
 * permission to view it. Should be used only for asset routes.
 *
 * @prop {string} path - one of PATHS
 * @prop {object} route
 * @prop {object} route.protectedComponent - the target route commponent that should be displayed for authenticateed user
 * @prop {array} route.requiredPermissions - the list of permissions needed to be able to see the route
 * @prop {boolean} route.requireAll - toggle whether all permissions of `requiredPermissions` are required or only one of them
 */
class PermProtectedRoute extends React.Component {
  constructor(props) {
    super(props);
    this.state = this.getInitialState();
    this.unlisteners = [];
    autoBind(this);
  }

  getInitialState() {
    return {
      // Whether loadAsset call was made and ended, regardless of success or failure
      isLoadAssetFinished: false,
      userHasRequiredPermissions: null,
      errorMessage: null,
      asset: null,
    };
  }

  componentDidMount() {
    this.unlisteners.push(
      actions.resources.loadAsset.completed.listen(this.onLoadAssetCompleted),
      actions.resources.loadAsset.failed.listen(this.onLoadAssetFailed)
    );
    actions.resources.loadAsset({id: this.props.params.uid});
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {
      clb();
    });
  }

  componentWillReceiveProps(nextProps) {
    if (this.props.params.uid !== nextProps.params.uid) {
      this.setState(this.getInitialState());
      actions.resources.loadAsset({id: nextProps.params.uid});
    } else if (
      this.props.requiredPermissions !== nextProps.requiredPermissions ||
      this.props.requireAll !== nextProps.requireAll ||
      this.props.protectedComponent !== nextProps.protectedComponent
    ) {
      this.setState({
        userHasRequiredPermissions: this.getUserHasRequiredPermissions(
          this.state.asset,
          nextProps.requiredPermissions,
          nextProps.requireAll
        ),
      });
    }
  }

  onLoadAssetCompleted(asset) {
    if (asset.uid !== this.props.params.uid) {
      return;
    }

    this.setState({
      asset: asset,
      isLoadAssetFinished: true,
      userHasRequiredPermissions: this.getUserHasRequiredPermissions(
        asset,
        this.props.requiredPermissions,
        this.props.requireAll
      ),
    });
  }

  onLoadAssetFailed(response) {
    if (response.status >= 400) {
      this.setState({
        isLoadAssetFinished: true,
        userHasRequiredPermissions: false,
        errorMessage: `${response.status.toString()}: ${
          response.responseJSON?.detail || response.statusText
        }`,
      });
    }
  }

  getUserHasRequiredPermission(asset, requiredPermission) {
    return (
      // we are ok with either full or partial permission
      userCan(requiredPermission, asset) ||
      userCanPartially(requiredPermission, asset)
    );
  }

  getUserHasRequiredPermissions(asset, requiredPermissions, all = false) {
    if (all) {
      return requiredPermissions.every((perm) => this.getUserHasRequiredPermission(asset, perm));
    } else {
      return requiredPermissions.some((perm) => this.getUserHasRequiredPermission(asset, perm));
    }
  }

  render() {
    if (!this.state.isLoadAssetFinished) {
      return <LoadingSpinner />;
    } else if (this.state.userHasRequiredPermissions) {
      return (
        <Suspense fallback={<LoadingSpinner />}>
          <this.props.protectedComponent
            {...this.props}
            initialAssetLoadNotNeeded
          />
        </Suspense>
      );
    } else {
      return <AccessDenied errorMessage={this.state.errorMessage} />;
    }
  }
}

export default withRouter(PermProtectedRoute);
