import React from 'react';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Checkbox from 'js/components/checkbox';
import mixins from 'js/mixins';
import actions from 'js/actions';
import bem from 'js/bem';
import {t} from 'js/utils';
import {
  ROOT_URL,
  ANON_USERNAME
} from 'js/constants';

class PublicShareSettings extends React.Component {
  constructor(props) {
    super(props);
    autoBind(this);
  }
  togglePerms(permRole) {
    var permission = this.props.publicPerms.filter(function(perm){return perm.permission === permRole;})[0];

    if (permission) {
      actions.permissions.removePerm({
        permission_url: permission.url,
        content_object_uid: this.props.uid
      });
    } else {
      actions.permissions.assignPerm({
        username: ANON_USERNAME,
        uid: this.props.uid,
        kind: this.props.kind,
        objectUrl: this.props.objectUrl,
        role: permRole === 'view_asset' ? 'view' : permRole
      });
    }
  }
  render () {
    var uid = this.props.uid;
    var href = `${ROOT_URL}/#/forms/${uid}`;
    var url = `${window.location.protocol}//${window.location.host}${href}`;

    var anonCanView = this.props.publicPerms.filter(function(perm){return perm.permission === 'view_asset';})[0];
    var anonCanViewData = this.props.publicPerms.filter(function(perm){return perm.permission === 'view_submissions';})[0];

    return (
      <bem.FormModal__item m='permissions'>
        <bem.FormModal__item>
          <Checkbox
            checked={anonCanView ? true : false}
            onChange={this.togglePerms.bind(this, 'view_asset')}
            label={t('Anyone can view this form')}
          />
        </bem.FormModal__item>

        { this.props.deploymentActive &&
          <bem.FormModal__item>
            <Checkbox
              checked={anonCanViewData ? true : false}
              onChange={this.togglePerms.bind(this, 'view_submissions')}
              label={t('Anyone can view submissions made to this form')}
            />
          </bem.FormModal__item>
        }

        { anonCanView &&
          <bem.FormModal__item m='shareable-link'>
            <label>
              {t('Shareable link')}
            </label>
            <input type='text' value={url} readOnly />
          </bem.FormModal__item>
        }
      </bem.FormModal__item>
    );
  }
}

reactMixin(PublicShareSettings.prototype, mixins.permissions);

export default PublicShareSettings;
