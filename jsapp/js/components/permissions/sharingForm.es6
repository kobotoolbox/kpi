import React from 'react';
import PropTypes from 'prop-types';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import Checkbox from 'js/components/checkbox';
import mixins from 'js/mixins';
import stores from 'js/stores';
import actions from 'js/actions';
import bem from 'js/bem';
import {
  t,
  parsePermissions,
  stringToColor,
  anonUsername
} from 'js/utils';

// parts
import CopyTeamPermissions from './copyTeamPermissions';
import UserPermissionsEditor from './userPermissionsEditor';

var availablePermissions = [
  {value: 'view', label: t('View Form')},
  {value: 'change', label: t('Edit Form')},
  {value: 'view_submissions', label: t('View Submissions')},
  {value: 'add_submissions', label: t('Add Submissions')},
  {value: 'change_submissions', label: t('Edit Submissions')},
  {value: 'validate_submissions', label: t('Validate Submissions')}
];

class UserPermissionRow extends React.Component {
  constructor(props) {
    super(props);
    autoBind(this);

    this.state = {
      isEditFormVisible: false,
      isBeingDeleted: false
    };
  }

  componentDidMount() {
    this.listenTo(stores.asset, this.onAssetChange);
  }

  onAssetChange() {
    // fixes bug that caused a readding deleted user disabled
    this.setState({isBeingDeleted: false});
  }

  removePermissions() {
    this.setState({isBeingDeleted: true});
    // we remove "view" permission, as it is the most basic one, so removing it
    // will in fact remove all permissions
    actions.permissions.removePerm({
      permission_url: this.props.can.view.url,
      content_object_uid: this.props.uid
    });
  }

  PermOnChange(perm) {
    var cans = this.props.can;
    if (perm) {
      var permName = perm.value;
      this.setPerm(permName, this.props);
      if (permName === 'view' && cans.change) {
        this.removePerm('change', cans.change, this.props.uid);
      }
    } else {
      if (cans.view) {
        this.removePerm('view', cans.view, this.props.uid);
      }
      if (cans.change) {
        this.removePerm('change', cans.change, this.props.uid);
      }
    }
  }

  toggleEditForm() {
    this.setState({isEditFormVisible: !this.state.isEditFormVisible});
  }

  render () {
    var initialsStyle = {
      background: `#${stringToColor(this.props.username)}`
    };

    var cans = [];
    for (var key in this.props.can) {
      let perm = availablePermissions.find(function (d) {return d.value === key;});
      if (perm && perm.label) {
        cans.push(perm.label);
      }
    }

    const cansString = cans.sort().join(', ');

    const modifiers = [];
    if (cans.length === 0) {
      modifiers.push('deleted');
    }
    if (this.state.isBeingDeleted) {
      modifiers.push('pending');
    }

    return (
      <bem.UserRow m={modifiers}>
        <bem.UserRow__info>
          <bem.UserRow__avatar>
            <bem.AccountBox__initials style={initialsStyle}>
              {this.props.username.charAt(0)}
            </bem.AccountBox__initials>
          </bem.UserRow__avatar>

          <bem.UserRow__name>
            {this.props.username}
          </bem.UserRow__name>

          <bem.UserRow__role title={cansString}>
            {cansString}
          </bem.UserRow__role>

          <bem.Button m='icon' onClick={this.toggleEditForm}>
            {this.state.isEditFormVisible &&
              <i className='k-icon k-icon-close'/>
            }
            {!this.state.isEditFormVisible &&
              <i className='k-icon k-icon-edit'/>
            }
          </bem.Button>

          <bem.Button m='icon' onClick={this.removePermissions}>
            <i className='k-icon k-icon-trash' />
          </bem.Button>
        </bem.UserRow__info>

        {this.state.isEditFormVisible &&
          <bem.UserRow__editor>
            <UserPermissionsEditor
              username={this.props.username}
              cans={this.props.cans}
            />
          </bem.UserRow__editor>
        }
      </bem.UserRow>
      );
  }
}

reactMixin(UserPermissionRow.prototype, mixins.permissions);
reactMixin(UserPermissionRow.prototype, Reflux.ListenerMixin);

class PublicPermDiv extends React.Component {
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
        username: anonUsername,
        uid: this.props.uid,
        kind: this.props.kind,
        objectUrl: this.props.objectUrl,
        role: permRole === 'view_asset' ? 'view' : permRole
      });
    }
  }
  render () {
    var uid = this.props.uid;

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

reactMixin(PublicPermDiv.prototype, mixins.permissions);

class SharingForm extends React.Component {
  constructor(props) {
    super(props);
    autoBind(this);
    this.state = {
      isAddUserEditorVisible: false
    };
  }

  componentDidMount () {
    if (this.props.uid) {
      actions.resources.loadAsset({id: this.props.uid});
    }
    this.listenTo(stores.asset, this.assetChange);
  }

  assetChange (data) {
    var uid = this.props.uid || this.currentAssetID(),
      asset = data[uid];

    if (asset) {
      this.setState({
        asset: asset,
        permissions: asset.permissions,
        owner: asset.owner__username,
        parsedPerms: parsePermissions(asset.owner__username, asset.permissions),
        public_permissions: asset.permissions.filter(function(perm){return perm.user__username === anonUsername;}),
        related_users: stores.asset.relatedUsers[uid]
      });
    }
  }

  toggleAddUserEditor() {
    this.setState({isAddUserEditorVisible: !this.state.isAddUserEditorVisible});
  }

  onPermissionsEditorSubmitEnd(isSuccess) {
    if (isSuccess) {
      this.setState({isAddUserEditorVisible: false});
    }
  }

  renderLoadingMessage() {
    return (
      <bem.Loading>
        <bem.Loading__inner>
          <i />
          {t('loading...')}
        </bem.Loading__inner>
      </bem.Loading>
    );
  }

  render () {
    if (!this.state.parsedPerms) {
      return this.renderLoadingMessage();
    }

    var _perms = this.state.parsedPerms;
    var perms = this.state.related_users.map(function(username) {
      var currentPerm = _perms.filter(function(p){
        return p.username === username;
      })[0];
      if (currentPerm) {
        return currentPerm;
      } else {
        return {
          username: username,
          can: {}
        };
      }
    });

    let uid = this.state.asset.uid,
        kind = this.state.asset.kind,
        asset_type = this.state.asset.asset_type,
        objectUrl = this.state.asset.url,
        name = this.state.asset.name;

    if (!perms) {
      return this.renderLoadingMessage();
    }

    var initialsStyle = {
      background: `#${stringToColor(this.state.asset.owner__username)}`
    };

    if (asset_type !== 'survey') {
      availablePermissions = [
        {value: 'view', label: t('View')},
        {value: 'change', label: t('Edit')},
      ];
    }

    return (
      <bem.FormModal m='sharing-form'>
        <bem.Modal__subheader>
          {name}
        </bem.Modal__subheader>

        {/* list of users and their permissions */}
        <bem.FormModal__item m='users-permissions'>
          <h2>{t('Who has access')}</h2>

          <bem.UserRow>
            <bem.UserRow__info>
              <bem.UserRow__avatar>
                <bem.AccountBox__initials style={initialsStyle}>
                  {this.state.asset.owner__username.charAt(0)}
                </bem.AccountBox__initials>
              </bem.UserRow__avatar>

              <bem.UserRow__name>
                <div>{this.state.asset.owner__username}</div>
              </bem.UserRow__name>

              <bem.UserRow__role>{t('is owner')}</bem.UserRow__role>
            </bem.UserRow__info>
          </bem.UserRow>

          {perms.map((perm) => {
            return <UserPermissionRow
              key={`perm.${uid}.${perm.username}`}
              ref={perm.username}
              uid={uid}
              kind={kind}
              objectUrl={objectUrl}
              {...perm}
            />;
          })}

          {!this.state.isAddUserEditorVisible &&
            <bem.Button
              m={['raised', 'colored']}
              onClick={this.toggleAddUserEditor}
            >
              {t('Add user')}
            </bem.Button>
          }

          {this.state.isAddUserEditorVisible &&
            <bem.FormModal__item m='gray-row'>
              <bem.Button m='icon' onClick={this.toggleAddUserEditor}>
                <i className='k-icon k-icon-close'/>
              </bem.Button>

              <UserPermissionsEditor
                uid={uid}
                kind={kind}
                objectUrl={objectUrl}
                onSubmitEnd={this.onPermissionsEditorSubmitEnd}
              />
            </bem.FormModal__item>
          }
        </bem.FormModal__item>

        {/* public sharing settings */}
        { kind !== 'collection' && asset_type === 'survey' &&
          <bem.FormModal__item m='share-settings'>
            <h2>{t('Select share settings')}</h2>

            <PublicPermDiv
              uid={uid}
              publicPerms={this.state.public_permissions}
              kind={kind}
              objectUrl={objectUrl}
              deploymentActive={this.state.asset.deployment__active}
            />
          </bem.FormModal__item>
        }

        {/* copying permissions from other assets */}
        { kind !== 'collection' && Object.keys(stores.allAssets.byUid).length >= 2 &&
          <bem.FormModal__item m='copy-team-permissions'>
            <CopyTeamPermissions uid={uid}/>
          </bem.FormModal__item>
        }
      </bem.FormModal>
    );
  }
}

SharingForm.contextTypes = {
  router: PropTypes.object
};

reactMixin(SharingForm.prototype, mixins.permissions);
reactMixin(SharingForm.prototype, mixins.contextRouter);
reactMixin(SharingForm.prototype, Reflux.ListenerMixin);

export default SharingForm;
