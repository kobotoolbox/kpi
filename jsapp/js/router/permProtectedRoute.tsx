import { observer } from 'mobx-react-lite'
import React, { Suspense, useEffect } from 'react'

import { actions } from '#/actions'
import assetStore from '#/assetStore'
import { getAuthGateDecision } from '#/auth/authGate'
import { useAuthStatus } from '#/auth/useAuthStatus'
import { useGoToLogin } from '#/auth/useGoToLogin'
import LoadingSpinner from '#/components/common/loadingSpinner'
import type { PermissionCodename } from '#/components/permissions/permConstants'
import { userCan, userCanPartially } from '#/components/permissions/utils'
import { decodeURLParamWithSlash } from '#/components/processing/routes.utils'
import type { AssetResponse, FailResponse } from '#/dataInterface'
import { FeatureFlag, useFeatureFlag } from '#/featureFlags'
import AccessDenied from '#/router/accessDenied'
import type { WithRouterProps } from '#/router/legacy'
import profileStore from '#/stores/profile'
import { withRouter } from './legacy'

interface PermProtectedRouteProps extends WithRouterProps {
  /** One of PATHS */
  path: string
  /** The target route commponent that should be displayed for authenticateed user. */
  protectedComponent: React.ElementType
  /** The list of permissions needed to be able to see the route. */
  requiredPermissions: PermissionCodename[]
  /** Whether all permissions of `requiredPermissions` are required or only one of them */
  requireAll: boolean
}

interface PermProtectedRouteState {
  /** Whether loadAsset call was made and ended, regardless of success or failure. */
  isLoadAssetFinished: boolean
  userHasRequiredPermissions: boolean | null
  /** Status the asset request failed with, absent when it was the permissions that said no. */
  errorStatus?: number
  errorMessage?: string
  asset: AssetResponse | null
  /**
   * Tells the `dmix` mixin (from `mixins.tsx`) that this route component
   * already handled asset load, so `dmix` doesn't have to.
   */
  initialAssetLoadNotNeeded: boolean
}

interface AssetAccessDeniedProps {
  errorStatus?: number
  errorMessage?: string
}

/**
 * What an asset route shows once it has turned somebody away. With no session the refusal may be premature, so the
 * login screen gets a turn first, carrying this route in `next`. Separate component as the class below cannot use
 * hooks, and an `observer` because the flag-off path reads `profileStore`.
 */
const AssetAccessDenied = observer(function AssetAccessDenied({ errorStatus, errorMessage }: AssetAccessDeniedProps) {
  const { data: authStatus, isLoading, isError } = useAuthStatus()
  const isAuthRedesignEnabled = useFeatureFlag(FeatureFlag.authRedesignEnabled)
  const goToLogin = useGoToLogin()

  const decision = getAuthGateDecision({
    authStatus,
    // With the flag off the session query never runs, so `/me/` stands in for it. A reading that failed or has not
    // arrived must not pass for "signed out", or this bounces off the login screen.
    isAuthStatusLoading: isAuthRedesignEnabled ? isLoading : !profileStore.isAuthStateKnown,
    isAuthStatusCheckFailed: isAuthRedesignEnabled ? isError : profileStore.isAuthStateCheckFailed,
    isLegacyLoggedIn: isAuthRedesignEnabled ? false : profileStore.isLoggedIn,
  })

  // Signing in will not fix a 5xx. `checkFailed` keeps the refusal too, as the asset error says more than a
  // session-check failure would.
  const shouldGoToLogin = decision === 'redirect' && (!errorStatus || errorStatus < 500)

  useEffect(() => {
    if (shouldGoToLogin) {
      goToLogin()
    }
  }, [shouldGoToLogin, goToLogin])

  // Navigation happens in an effect, so the spinner also covers the render that starts it.
  if (shouldGoToLogin || decision === 'wait') {
    return <LoadingSpinner />
  }

  return <AccessDenied errorMessage={errorMessage} />
})

/**
 * A gateway component for rendering the route only for a user who has
 * permission to view it. Should be used only for asset routes.
 */
class PermProtectedRoute extends React.Component<PermProtectedRouteProps, PermProtectedRouteState> {
  private unlisteners: Function[] = []

  constructor(props: PermProtectedRouteProps) {
    super(props)
    this.state = this.getInitialState()
    this.unlisteners = []
  }

  getInitialState(): PermProtectedRouteState {
    return {
      isLoadAssetFinished: false,
      userHasRequiredPermissions: null,
      errorStatus: undefined,
      errorMessage: undefined,
      asset: null,
      initialAssetLoadNotNeeded: false,
    }
  }

  componentDidMount() {
    if (!this.props.params.uid) {
      return
    }

    // Listen to incoming load of asset
    this.unlisteners.push(
      actions.resources.loadAsset.completed.listen(this.onLoadAssetCompleted.bind(this)),
      actions.resources.loadAsset.failed.listen(this.onLoadAssetFailed.bind(this)),
    )

    // See if the asset is already loaded in the store
    const assetFromStore = assetStore.getAsset(this.props.params.uid)
    if (assetFromStore) {
      // If this asset was already loaded before, we are not going to be picky
      // and require a fresh one. We only need to know the permissions, and
      // those are most probably up to date.
      // This helps us avoid unnecessary API calls and spinners being displayed
      // in the UI (from this component; see `render()` below).
      // This code previously was simply calling `onLoadAssetCompleted`, but it
      // caused some edge cases bugs. We will instead call the usual load action
      // but telling the function to return cached result
      actions.resources.loadAsset({ id: this.props.params.uid }, false)
    } else {
      this.setState({ initialAssetLoadNotNeeded: true })
      actions.resources.loadAsset({ id: this.props.params.uid }, true)
    }
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {
      clb()
    })
  }

  componentWillReceiveProps(nextProps: PermProtectedRouteProps) {
    if (this.props.params.uid !== nextProps.params.uid) {
      this.setState(this.getInitialState())
      actions.resources.loadAsset({ id: nextProps.params.uid })
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
            nextProps.requireAll,
          ),
        })
      }
    }
  }

  onLoadAssetCompleted(asset: AssetResponse) {
    if (asset.uid !== this.props.params.uid) {
      return
    }

    this.setState({
      asset: asset,
      isLoadAssetFinished: true,
      userHasRequiredPermissions: this.getUserHasRequiredPermissions(
        asset,
        this.props.requiredPermissions,
        this.props.requireAll,
      ),
    })
  }

  onLoadAssetFailed(response: FailResponse) {
    if (response.status >= 400) {
      this.setState({
        isLoadAssetFinished: true,
        userHasRequiredPermissions: false,
        errorStatus: response.status,
        errorMessage: `${response.status.toString()}: ${response.responseJSON?.detail || response.statusText}`,
      })
    }
  }

  /**
   * This function is needed to override the `xpath` in the route params. If it
   * is not present, `params` would be returned untouched.
   */
  filterProps(props: any) {
    const { params, ...rest } = props
    if (!params?.xpath) {
      return props
    }

    const { xpath, ...restParams } = params
    const decodedXPath = decodeURLParamWithSlash(xpath)

    if (xpath !== decodedXPath) {
      return {
        ...rest,
        params: {
          xpath: decodedXPath,
          ...restParams,
        },
      }
    } else {
      return props
    }
  }

  getUserHasRequiredPermission(asset: AssetResponse, requiredPermission: PermissionCodename) {
    return (
      // we are ok with either full or partial permission
      userCan(requiredPermission, asset) || userCanPartially(requiredPermission, asset)
    )
  }

  getUserHasRequiredPermissions(asset: AssetResponse, requiredPermissions: PermissionCodename[], all = false) {
    if (all) {
      return requiredPermissions.every((perm) => this.getUserHasRequiredPermission(asset, perm))
    } else {
      return requiredPermissions.some((perm) => this.getUserHasRequiredPermission(asset, perm))
    }
  }

  render() {
    if (!this.state.isLoadAssetFinished) {
      return <LoadingSpinner />
    } else if (this.state.userHasRequiredPermissions) {
      const filteredProps = this.filterProps(this.props)
      return (
        <Suspense fallback={<LoadingSpinner />}>
          <this.props.protectedComponent
            {...filteredProps}
            asset={this.state.asset}
            initialAssetLoadNotNeeded={this.state.initialAssetLoadNotNeeded}
          />
        </Suspense>
      )
    } else {
      return <AssetAccessDenied errorStatus={this.state.errorStatus} errorMessage={this.state.errorMessage} />
    }
  }
}

export default withRouter(PermProtectedRoute)
