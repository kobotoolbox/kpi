import React from 'react';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Checkbox from 'js/components/checkbox';
import mixins from 'js/mixins';
import actions from 'js/actions';
import bem from 'js/bem';
import {t} from 'js/utils';
import {ANON_USERNAME} from 'js/constants';

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
        content_object_uid: this.props.assetUid
      });
    } else {
      actions.permissions.assignPerm({
        username: ANON_USERNAME,
        uid: this.props.assetUid,
        kind: this.props.assetKind,
        objectUrl: this.props.objectUrl,
        role: permRole === 'view_asset' ? 'view' : permRole
      });
    }
  }
  render () {
    var uid = this.props.assetUid;

    var href = `#/forms/${uid}`;
    var url = `${window.location.protocol}//${window.location.host}/${href}`;

    var anonCanView = this.props.publicPerms.filter(function(perm){return perm.permission === 'view_asset';})[0];
    var anonCanViewData = this.props.publicPerms.filter(function(perm){return perm.permission === 'view_submissions';})[0];

    return (
      <bem.FormModal__item m='permissions'>
        <bem.FormModal__item m='perms-link'>
          <Checkbox
            checked={anonCanView ? true : false}
            onChange={this.togglePerms.bind(this, 'view_asset')}
            label={t('Share by link')}
          />
          { anonCanView &&
            <bem.FormModal__item m='shareable-link'>
              <label>
                {t('Shareable link')}
              </label>
              <input type='text' value={url} readOnly />
            </bem.FormModal__item>
          }
        </bem.FormModal__item>
        { this.props.deploymentActive &&
          <bem.FormModal__item m='perms-public-data'>
            <Checkbox
              checked={anonCanViewData ? true : false}
              onChange={this.togglePerms.bind(this, 'view_submissions')}
              label={t('Share data publicly')}
            />
          </bem.FormModal__item>
        }
      </bem.FormModal__item>
    );
  }
}

reactMixin(PublicShareSettings.prototype, mixins.permissions);

export default PublicShareSettings;
