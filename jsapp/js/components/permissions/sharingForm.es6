import React from 'react';
import PropTypes from 'prop-types';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import mixins from 'js/mixins';
import {stores} from 'js/stores';
import {actions} from 'js/actions';
import bem from 'js/bem';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import {buildUserUrl} from 'utils';
import {
  ASSET_TYPES,
  ANON_USERNAME,
} from 'js/constants';
import './sharingForm.scss';
import {ROUTES} from 'js/router/routerConstants';
// parts
import CopyTeamPermissions from './copyTeamPermissions';
import UserAssetPermsEditor from './userAssetPermsEditor';
import PublicShareSettings from './publicShareSettings';
import UserPermissionRow from './userPermissionRow';
import {permParser} from './permParser';

class SharingForm extends React.Component {
  constructor(props) {
    super(props);
    autoBind(this);
    this.state = {
      allAssetsCount: 0,
      isAddUserEditorVisible: false,
    };
  }

  componentDidMount() {
    this.listenTo(stores.asset, this.onAssetChange);
    this.listenTo(stores.allAssets, this.onAllAssetsChange);
    this.listenTo(actions.permissions.bulkSetAssetPermissions.completed, this.onAssetPermissionsUpdated);
    this.listenTo(actions.permissions.getAssetPermissions.completed, this.onAssetPermissionsUpdated);

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
      publicPerms: publicPerms,
    });
  }

  onAssetChange(data) {
    const uid = this.props.uid || this.currentAssetID;
    const asset = data[uid];

    if (asset) {
      this.setState({asset: asset});
    }

    this.setState({
      assignablePerms: this.getAssignablePermsMap(asset.assignable_permissions)
    });
    // we need to fetch permissions after asset has loaded,
    // as we need the owner username to parse permissions
    actions.permissions.getAssetPermissions(uid);
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

  render() {
    if (!this.state.permissions) {
      return (<LoadingSpinner/>);
    }

    let uid = this.state.asset.uid,
        asset_type = this.state.asset.asset_type,
        objectUrl = this.state.asset.url;

    return (
      <bem.FormModal m='sharing-form'>
        <bem.Modal__subheader>
          {this.state.asset.name}
        </bem.Modal__subheader>

        {stores.session.currentAccount.extra_details?.require_auth !== true &&
          <bem.FormModal__item>
            <bem.FormView__cell m='warning'>
              <i className='k-icon k-icon-alert' />
              <p>
                {t('Anyone can see this blank form and add submissions to it because you have not set ')}
                <a href={`/#${ROUTES.ACCOUNT_SETTINGS}`}>
                  {t('your account')}
                </a>
                {t(' to require authentication.')}
              </p>
            </bem.FormView__cell>
          </bem.FormModal__item>
        }

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
              assetType={asset_type}
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

              <UserAssetPermsEditor
                uid={uid}
                assignablePerms={this.state.assignablePerms}
                nonOwnerPerms={this.state.nonOwnerPerms}
                onSubmitEnd={this.onPermissionsEditorSubmitEnd}
              />

            </bem.FormModal__item>
          }
        </bem.FormModal__item>

        {/* public sharing settings */}
        { asset_type === ASSET_TYPES.survey.id &&
          <React.Fragment>
            <bem.Modal__hr/>

            <bem.FormModal__item m='share-settings'>
              <h2>{t('Share publicly by link')}</h2>

              <PublicShareSettings
                publicPerms={this.state.publicPerms}
                uid={uid}
                objectUrl={objectUrl}
                deploymentActive={this.state.asset.deployment__active}
              />
            </bem.FormModal__item>
          </React.Fragment>
        }

        {/* copying permissions from other assets */}
        { asset_type !== ASSET_TYPES.collection.id && this.state.allAssetsCount === 0 &&
          <React.Fragment>
            <bem.Modal__hr/>
            {t('Waiting for all projects to load…')}
          </React.Fragment>
        }
        { asset_type !== ASSET_TYPES.collection.id && this.state.allAssetsCount >= 2 &&
          <React.Fragment>
            <bem.Modal__hr/>
            <CopyTeamPermissions uid={uid}/>
          </React.Fragment>
        }
      </bem.FormModal>
    );
  }
}

SharingForm.contextTypes = {router: PropTypes.object};

reactMixin(SharingForm.prototype, mixins.permissions);
reactMixin(SharingForm.prototype, mixins.contextRouter);
reactMixin(SharingForm.prototype, Reflux.ListenerMixin);

export default SharingForm;
