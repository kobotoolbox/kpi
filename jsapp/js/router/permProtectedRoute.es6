import React from 'react';
import autoBind from 'react-autobind';
import {actions} from 'js/actions';
import mixins from 'js/mixins';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import AccessDenied from 'js/router/accessDenied';

/**
 * A generic component for rendering the route only for a user who has
 * permission to view it. Should be used only for asset routes.
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
      // Whether loadAsset call was made and ended, regardless of success or failure
      isLoadAssetFinished: false,
      userHasRequiredPermission: null,
    };
    autoBind(this);
  }

  componentDidMount() {
    actions.resources.loadAsset.completed.listen(this.onLoadAssetCompleted);
    actions.resources.loadAsset.failed.listen(this.onLoadAssetFailed);
    actions.resources.loadAsset({id: this.props.params.uid});
  }

  onLoadAssetCompleted(asset) {
    const requiredPermission = this.props.route.requiredPermission;
    this.setState({
      isLoadAssetFinished: true,
      userHasRequiredPermission: (
        // we are ok with either full or partial permission
        mixins.permissions.userCan(requiredPermission, asset) ||
        mixins.permissions.userCanPartially(requiredPermission, asset)
      ),
    });
  }

  onLoadAssetFailed(response) {
    if (response.status === 404) {
      this.setState({
        isLoadAssetFinished: true,
        userHasRequiredPermission: false,
      });
    }
  }

  render() {
    if (!this.state.isLoadAssetFinished) {
      return <LoadingSpinner/>;
    } else if (this.state.userHasRequiredPermission) {
      return (
        <this.props.route.protectedComponent
          params={this.props.params}
          initialAssetLoadNotNeeded
        />
      );
    } else {
      return <AccessDenied/>;
    }
  }
}
