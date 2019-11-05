import React from 'react';
import reactMixin from 'react-mixin';
import Reflux from 'reflux';
import autoBind from 'react-autobind';
import permConfig from './permConfig';
import actions from 'js/actions';
import {
  t,
  notify,
  replaceSupportEmail
} from 'js/utils';

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
    console.debug('validateBackendData', permissionAssignments);
    notify(replaceSupportEmail(INVALID_PERMS_ERROR), 'error');
  }

  render () {
    return null;
  }
}

reactMixin(PermValidator.prototype, Reflux.ListenerMixin);

export default PermValidator;
