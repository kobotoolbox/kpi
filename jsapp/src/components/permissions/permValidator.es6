import React from 'react';
import reactMixin from 'react-mixin';
import Reflux from 'reflux';
import autoBind from 'react-autobind';
import permConfig from './permConfig';
import {actions} from '../../actions';
import _ from 'underscore';
import {
  notify,
  replaceSupportEmail
} from 'utils';

const INVALID_PERMS_ERROR = t('The stored permissions are invalid. Please assign them again. If this problem persists, contact help@kobotoolbox.org');

class PermValidator extends React.Component {
  constructor(props){
    super(props);
    autoBind(this);
  }

  componentDidMount() {
    this.listenTo(actions.permissions.getAssetPermissions.completed, this.validateBackendData);
  }

  validateBackendData(permissionAssignments) {
    let allImplied = [];
    let allContradictory = [];

    const appendUserUrl = (permission, userUrl) => `${permission}###${userUrl}`;
    const appendUserUrls = (permissions, userUrl) => {
      return permissions.map((permission) => appendUserUrl(permission, userUrl));
    };

    permissionAssignments.forEach((assignment) => {
      const permDef = permConfig.getPermission(assignment.permission);
      allImplied = _.union(allImplied, appendUserUrls(permDef.implied, assignment.user));
      allContradictory = _.union(allContradictory, appendUserUrls(permDef.contradictory, assignment.user));
    });

    let hasAllImplied = true;
    // FIXME: `manage_asset` implies all the `*_submission` permissions, but
    // those are assignable *only* when the asset type is 'survey'. We need to
    // design a way to pass that nuance from the back end to the front end
    /*
    allImplied.forEach((implied) => {
      let isFound = false;
      permissionAssignments.forEach((assignment) => {
        let permission = appendUserUrl(assignment.permission, assignment.user);
        if (permission === implied) {
          isFound = true;
        }
      });
      if (isFound === false) {
        hasAllImplied = false;
      }
    });
    */

    let hasAnyContradictory = false;
    allContradictory.forEach((contradictory) => {
      permissionAssignments.forEach((assignment) => {
        let permission = appendUserUrl(assignment.permission, assignment.user);
        if (permission === contradictory) {
          hasAnyContradictory = true;
        }
      });
    });

    if (!hasAllImplied || hasAnyContradictory) {
      notify(replaceSupportEmail(INVALID_PERMS_ERROR), 'error');
    }
  }

  render () {
    return null;
  }
}

reactMixin(PermValidator.prototype, Reflux.ListenerMixin);

export default PermValidator;
