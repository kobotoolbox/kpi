import React, {Suspense} from 'react';
import {actions} from 'js/actions';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import AccessDenied from 'js/router/accessDenied';
import {withRouter} from './legacy';
import {userCan, userCanPartially} from 'js/components/permissions/utils';
import assetStore from 'js/assetStore';
import type {PermissionCodename} from 'js/components/permissions/permConstants';
import type {WithRouterProps} from 'jsapp/js/router/legacy';
import type {AssetResponse, FailResponse} from 'js/dataInterface';
import {decodeURLParamWithSlash} from "js/components/processing/routes.utils";

interface PermProtectedRouteProps extends WithRouterProps {
  /** One of PATHS */
  path: string;
  /** The target route commponent that should be displayed for authenticateed user. */
  protectedComponent: React.ElementType;
  /** The list of permissions needed to be able to see the route. */
  requiredPermissions: PermissionCodename[];
  /** Whether all permissions of `requiredPermissions` are required or only one of them */
  requireAll: boolean;
}

interface PermProtectedRouteState {
  /** Whether loadAsset call was made and ended, regardless of success or failure. */
  isLoadAssetFinished: boolean;
  userHasRequiredPermissions: boolean | null;
  errorMessage?: string;
  asset: AssetResponse | null;
  /**
   * Tells the `dmix` mixin (from `mixins.tsx`) that this route component
   * already handled asset load, so `dmix` doesn't have to.
   */
  initialAssetLoadNotNeeded: boolean;
}

/**
 * A gateway component for rendering the route only for a user who has
 * permission to view it. Should be used only for asset routes.
 */
class PermProtectedRoute extends React.Component<
  PermProtectedRouteProps,
  PermProtectedRouteState
> {
  private unlisteners: Function[] = [];

  constructor(props: PermProtectedRouteProps) {
    super(props);
    this.state = this.getInitialState();
    this.unlisteners = [];
  }

  getInitialState(): PermProtectedRouteState {
    return {
      isLoadAssetFinished: false,
      userHasRequiredPermissions: null,
      errorMessage: undefined,
      asset: null,
      initialAssetLoadNotNeeded: false,
    };
  }

  componentDidMount() {
    if (!this.props.params.uid) {
      return;
    }

    // Listen to incoming load of asset
    this.unlisteners.push(
      actions.resources.loadAsset.completed.listen(
        this.onLoadAssetCompleted.bind(this)
      ),
      actions.resources.loadAsset.failed.listen(
        this.onLoadAssetFailed.bind(this)
      )
    );

    // See if the asset is already loaded in the store
    const assetFromStore = assetStore.getAsset(this.props.params.uid);
    if (assetFromStore) {
      // If this asset was already loaded before, we are not going to be picky
      // and require a fresh one. We only need to know the permissions, and
      // those are most probably up to date.
      // This helps us avoid unnecessary API calls and spinners being displayed
      // in the UI (from this component; see `render()` below).
      // This code previously was simply calling `onLoadAssetCompleted`, but it
      // caused some edge cases bugs. We will instead call the usual load action
      // but telling the function to return cached result
      actions.resources.loadAsset({id: this.props.params.uid}, false);
    } else {
      this.setState({initialAssetLoadNotNeeded: true});
      actions.resources.loadAsset({id: this.props.params.uid}, true);
    }
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {
      clb();
    });
  }

  componentWillReceiveProps(nextProps: PermProtectedRouteProps) {
    if (this.props.params.uid !== nextProps.params.uid) {
      this.setState(this.getInitialState());
      actions.resources.loadAsset({id: nextProps.params.uid});
    } else if (
      this.props.requiredPermissions !== nextProps.requiredPermissions ||
      this.props.requireAll !== nextProps.requireAll ||
      this.props.protectedComponent !== nextProps.protectedComponent
    ) {
      if (this.state.asset) {
        this.setState({
          userHasRequiredPermissions: this.getUserHasRequiredPermissions(
            this.state.asset,
            nextProps.requiredPermissions,
            nextProps.requireAll
          ),
        });
      }
    }
  }

  onLoadAssetCompleted(asset: AssetResponse) {
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

  onLoadAssetFailed(response: FailResponse) {
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

  /**
   * This function is needed to override the `xpath` in the route params. If it
   * is not present, `params` would be returned untouched.
   */
  filterProps(props: any) {
    const {params, ...rest} = props;
    if (!params?.xpath) {
      return props;
    }

    const {xpath, ...restParams} = params;
    const decodedXPath = decodeURLParamWithSlash(xpath);

    if (xpath !== decodedXPath) {
      return {
        ...rest,
        params: {
          xpath: decodedXPath,
          ...restParams,
        },
      };
    } else {
      return props;
    }
  }

  getUserHasRequiredPermission(
    asset: AssetResponse,
    requiredPermission: PermissionCodename
  ) {
    return (
      // we are ok with either full or partial permission
      userCan(requiredPermission, asset) ||
      userCanPartially(requiredPermission, asset)
    );
  }

  getUserHasRequiredPermissions(
    asset: AssetResponse,
    requiredPermissions: PermissionCodename[],
    all = false
  ) {
    if (all) {
      return requiredPermissions.every((perm) =>
        this.getUserHasRequiredPermission(asset, perm)
      );
    } else {
      return requiredPermissions.some((perm) =>
        this.getUserHasRequiredPermission(asset, perm)
      );
    }
  }

  render() {
    if (!this.state.isLoadAssetFinished) {
      return <LoadingSpinner />;
    } else if (this.state.userHasRequiredPermissions) {
      const filteredProps = this.filterProps(this.props);
      return (
        <Suspense fallback={<LoadingSpinner />}>
          <this.props.protectedComponent
            {...filteredProps}
            initialAssetLoadNotNeeded={this.state.initialAssetLoadNotNeeded}
          />
        </Suspense>
      );
    } else {
      return <AccessDenied errorMessage={this.state.errorMessage} />;
    }
  }
}

export default withRouter(PermProtectedRoute);
