import React from 'react';
import Checkbox from 'js/components/common/checkbox';
import TextBox from 'js/components/common/textBox';
import {actions} from 'js/actions';
import bem from 'js/bem';
import permConfig from './permConfig';
import {ANON_USERNAME_URL} from 'js/users/utils';
import {ROOT_URL} from 'js/constants';
import type {PermissionCodename} from './permConstants';
import type {PermissionResponse} from 'jsapp/js/dataInterface';

interface PublicShareSettingsProps {
  publicPerms: PermissionResponse[];
  assetUid: string;
  deploymentActive: boolean;
}

class PublicShareSettings extends React.Component<PublicShareSettingsProps> {
  togglePerms(permCodename: PermissionCodename) {
    const permission = this.props.publicPerms.filter(
      (perm) =>
        perm.permission ===
        permConfig.getPermissionByCodename(permCodename)?.url
    )[0];
    if (permission) {
      actions.permissions.removeAssetPermission(
        this.props.assetUid,
        permission.url
      );
    } else {
      actions.permissions.assignAssetPermission(this.props.assetUid, {
        user: ANON_USERNAME_URL,
        permission: permConfig.getPermissionByCodename(permCodename)?.url,
      });
    }
  }

  render() {
    const uid = this.props.assetUid;
    const url = `${ROOT_URL}/#/forms/${uid}`;

    const anonCanViewPermUrl =
      permConfig.getPermissionByCodename('view_asset')?.url;
    const anonCanViewDataPermUrl =
      permConfig.getPermissionByCodename('view_submissions')?.url;

    const anonCanView = Boolean(
      this.props.publicPerms.filter(
        (perm) => perm.permission === anonCanViewPermUrl
      )[0]
    );
    const anonCanViewData = Boolean(
      this.props.publicPerms.filter(
        (perm) => perm.permission === anonCanViewDataPermUrl
      )[0]
    );

    return (
      <bem.FormModal__item m='permissions'>
        <bem.FormModal__item>
          <Checkbox
            checked={anonCanView}
            onChange={this.togglePerms.bind(this, 'view_asset')}
            label={t('Anyone can view this form')}
          />
        </bem.FormModal__item>

        {this.props.deploymentActive && (
          <bem.FormModal__item>
            <Checkbox
              checked={anonCanViewData}
              onChange={this.togglePerms.bind(this, 'view_submissions')}
              label={t('Anyone can view submissions made to this form')}
            />
          </bem.FormModal__item>
        )}

        {anonCanView && (
          <TextBox
            label={t('Shareable link')}
            type='text'
            readOnly
            value={url}
          />
        )}
      </bem.FormModal__item>
    );
  }
}

export default PublicShareSettings;
