import React from 'react';
import PropTypes from 'prop-types';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import mixins from 'js/mixins';
import {stores} from 'js/stores';
import {actions} from 'js/actions';
import {bem} from 'js/bem';
import {
  t,
  buildUserUrl
} from 'js/utils';
import {
  ASSET_KINDS,
  ANON_USERNAME
} from 'js/constants';

// parts
import CopyTeamPermissions from './copyTeamPermissions';
import UserAssetPermsEditor from './userAssetPermsEditor';
import UserCollectionPermsEditor from './userCollectionPermsEditor';
import PublicShareSettings from './publicShareSettings';
import UserPermissionRow from './userPermissionRow';
import {permParser} from './permParser';

class SharingForm extends React.Component {
  constructor(props) {
    super(props);
    autoBind(this);
    this.state = {
      allAssetsCount: 0,
      isAddUserEditorVisible: false
    };
  }

  componentDidMount () {
    this.listenTo(stores.asset, this.onAssetChange);
    this.listenTo(stores.allAssets, this.onAllAssetsChange);
    this.listenTo(actions.permissions.bulkSetAssetPermissions.completed, this.onAssetPermissionsUpdated);
    this.listenTo(actions.permissions.getAssetPermissions.completed, this.onAssetPermissionsUpdated);
    this.listenTo(actions.permissions.getCollectionPermissions.completed, this.onCollectionPermissionsUpdated);

    if (this.props.uid) {
      actions.resources.loadAsset({id: this.props.uid});
    }

    this.onAllAssetsChange();
  }

  onAllAssetsChange() {
    this.setState({allAssetsCount: Object.keys(stores.allAssets.byUid).length});
  }

  onAssetPermissionsUpdated(permissionAssignments) {
    const parsedPerms = permParser.parseBackendData(permissionAssignments, this.state.asset.owner, true);
    const anonUserUrl = buildUserUrl(ANON_USERNAME);
    const publicPerms = permissionAssignments.filter((assignment) => {
      return assignment.user === anonUserUrl;
    });
    const nonOwnerPerms = permParser.parseUserWithPermsList(parsedPerms).filter((perm) => {
      return perm.user !== buildUserUrl(this.state.asset.owner);
    });

    this.setState({
      permissions: parsedPerms,
      nonOwnerPerms: nonOwnerPerms,
      publicPerms: publicPerms
    });
  }

  onCollectionPermissionsUpdated(permissionAssignments) {
    const parsedPerms = permParser.parseBackendData(permissionAssignments, this.state.asset.owner, true);
    let nonOwnerPerms = permParser.parseUserWithPermsList(parsedPerms).filter((perm) => {
      return perm.user !== buildUserUrl(this.state.asset.owner);
    });

    this.setState({
      permissions: parsedPerms,
      nonOwnerPerms: nonOwnerPerms
    });
  }

  onAssetChange (data) {
    const uid = this.props.uid || this.currentAssetID;
    const asset = data[uid];

    if (asset) {
      this.setState({
        asset: asset,
        kind: asset.kind
      });
    }

    // TODO simplify this code when https://github.com/kobotoolbox/kpi/issues/2332 is done
    if (asset.kind === ASSET_KINDS.get('asset')) {
      this.setState({
        assignablePerms: this.getAssignablePermsMap(asset.assignable_permissions)
      });
      // we need to fetch permissions after asset has loaded,
      // as we need the owner username to parse permissions
      actions.permissions.getAssetPermissions(uid);
    } else if (asset.kind === ASSET_KINDS.get('collection')) {
      this.setState({
        permissions: permParser.parseOldBackendData(asset.permissions, asset.owner)
      });
    }
  }

  getAssignablePermsMap(backendPerms) {
    const assignablePerms = new Map();
    backendPerms.forEach((backendPerm) => {
      assignablePerms.set(backendPerm.url, backendPerm.label);
    });
    return assignablePerms;
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
    if (!this.state.permissions) {
      return this.renderLoadingMessage();
    }

    let uid = this.state.asset.uid,
        kind = this.state.asset.kind,
        asset_type = this.state.asset.asset_type,
        objectUrl = this.state.asset.url;

    return (
      <bem.FormModal m='sharing-form'>
        <bem.Modal__subheader>
          {this.state.asset.name}
        </bem.Modal__subheader>

        {/* list of users and their permissions */}
        <bem.FormModal__item>
          <h2>{t('Who has access')}</h2>

          {this.state.permissions.map((perm) => {
            // don't show anonymous user permissions in UI
            if (perm.user.name === ANON_USERNAME) {
              return null;
            }
            return <UserPermissionRow
              key={`perm.${uid}.${perm.user.name}`}
              uid={uid}
              nonOwnerPerms={this.state.nonOwnerPerms}
              assignablePerms={this.state.assignablePerms}
              kind={kind}
              {...perm}
            />;
          })}

          {!this.state.isAddUserEditorVisible &&
            <bem.KoboButton
              m='blue'
              onClick={this.toggleAddUserEditor}
            >
              {t('Add user')}
            </bem.KoboButton>
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

              {/* TODO simplify this code when https://github.com/kobotoolbox/kpi/issues/2332 is done */}
              {kind === ASSET_KINDS.get('asset') &&
                <UserAssetPermsEditor
                  uid={uid}
                  assignablePerms={this.state.assignablePerms}
                  nonOwnerPerms={this.state.nonOwnerPerms}
                  onSubmitEnd={this.onPermissionsEditorSubmitEnd}
                />
              }
              {kind === ASSET_KINDS.get('collection') &&
                <UserCollectionPermsEditor
                  uid={uid}
                  assignablePerms={this.state.assignablePerms}
                  onSubmitEnd={this.onPermissionsEditorSubmitEnd}
                />
              }

            </bem.FormModal__item>
          }
        </bem.FormModal__item>

        {/* public sharing settings */}
        { kind !== 'collection' && asset_type === 'survey' &&
          <React.Fragment>
            <bem.Modal__hr/>

            <bem.FormModal__item m='share-settings'>
              <h2>{t('Share publicly by link')}</h2>

              <PublicShareSettings
                publicPerms={this.state.publicPerms}
                uid={uid}
                kind={kind}
                objectUrl={objectUrl}
                deploymentActive={this.state.asset.deployment__active}
              />
            </bem.FormModal__item>
          </React.Fragment>
        }

        {/* copying permissions from other assets */}
        { kind !== 'collection' && this.state.allAssetsCount === 0 &&
          <React.Fragment>
            <bem.Modal__hr/>
            {t('Waiting for all projects to load…')}
          </React.Fragment>
        }
        { kind !== 'collection' && this.state.allAssetsCount >= 2 &&
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
