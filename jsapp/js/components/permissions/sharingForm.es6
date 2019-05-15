import React from 'react';
import PropTypes from 'prop-types';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
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
import PublicShareSettings from './publicShareSettings';
import UserPermissionRow from './userPermissionRow';
import permParser from './permParser';

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
    this.listenTo(
      actions.permissions.getAllAssetPermissions.completed,
      this.onGetAllAssetPermissionsCompleted
    );

    actions.permissions.getAllAssetPermissions(this.props.uid);
  }

  onGetAllAssetPermissionsCompleted(response) {
    console.debug('onGetAllAssetPermissionsCompleted', response, permParser.parse(response));
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

    return (
      <bem.FormModal m='sharing-form'>
        <bem.Modal__subheader>
          {name}
        </bem.Modal__subheader>

        {/* list of users and their permissions */}
        <bem.FormModal__item>
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
            <bem.FormModal__item m={['gray-row', 'copy-team-permissions']}>
              <bem.Button
                m='icon'
                className='user-permissions-editor-closer'
                onClick={this.toggleAddUserEditor}
              >
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
          <React.Fragment>
            <bem.Modal__hr/>

            <bem.FormModal__item m='share-settings'>
              <h2>{t('Select share settings')}</h2>

              <PublicShareSettings
                uid={uid}
                publicPerms={this.state.public_permissions}
                kind={kind}
                objectUrl={objectUrl}
                deploymentActive={this.state.asset.deployment__active}
              />
            </bem.FormModal__item>
          </React.Fragment>
        }

        {/* copying permissions from other assets */}
        { kind !== 'collection' && Object.keys(stores.allAssets.byUid).length >= 2 &&
          <React.Fragment>
            <bem.Modal__hr/>

            <CopyTeamPermissions uid={uid}/>
          </React.Fragment>
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
