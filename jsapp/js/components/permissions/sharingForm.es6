import React from 'react';
import PropTypes from 'prop-types';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import mixins from 'js/mixins';
import stores from 'js/stores';
import actions from 'js/actions';
import bem from 'js/bem';
import {t} from 'js/utils';
import {ANON_USERNAME} from 'js/constants';

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
    this.listenTo(stores.asset, this.onAssetChange);
    this.listenTo(actions.permissions.getAssetPermissions.completed, this.onGetAssetPermissionsCompleted);

    if (this.props.uid) {
      actions.resources.loadAsset({id: this.props.uid});
    }
  }

  onGetAssetPermissionsCompleted(response) {
    this.setState({
      permissions: permParser.parseBackendData(response.results, this.state.asset.owner)
    });
  }

  onAssetChange (data) {
    const uid = this.props.uid || this.currentAssetID;
    const asset = data[uid];

    if (asset) {
      console.debug('onAssetChange', asset);

      this.setState({
        asset: asset,
        assetKind: asset.kind,
        public_permissions: asset.permissions.filter(function(perm){return perm.user__username === ANON_USERNAME;}),
        related_users: stores.asset.relatedUsers[uid]
      });
    }

    // we need to fetch permissions after asset has loaded,
    // as we need the owner username to parse permissions
    actions.permissions.getAssetPermissions(uid);
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
        assetKind = this.state.asset.kind,
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
            return <UserPermissionRow
              key={`perm.${uid}.${perm.user.name}`}
              assetUid={uid}
              assetKind={assetKind}
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
                assetUid={uid}
                assetKind={assetKind}
                objectUrl={objectUrl}
                onSubmitEnd={this.onPermissionsEditorSubmitEnd}
              />
            </bem.FormModal__item>
          }
        </bem.FormModal__item>

        {/* public sharing settings */}
        { assetKind !== 'collection' && asset_type === 'survey' &&
          <React.Fragment>
            <bem.Modal__hr/>

            <bem.FormModal__item m='share-settings'>
              <h2>{t('Select share settings')}</h2>

              <PublicShareSettings
                publicPerms={this.state.public_permissions}
                assetUid={uid}
                assetKind={assetKind}
                objectUrl={objectUrl}
                deploymentActive={this.state.asset.deployment__active}
              />
            </bem.FormModal__item>
          </React.Fragment>
        }

        {/* copying permissions from other assets */}
        { assetKind !== 'collection' && Object.keys(stores.allAssets.byUid).length >= 2 &&
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
