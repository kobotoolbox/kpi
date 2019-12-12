import React from 'react';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import {bem} from 'js/bem';
import {actions} from 'js/actions';
import {
  isAssetPublicReady,
  isAssetPublic,
  getAssetOwnerDisplayName,
  getOrganizationDisplayString,
  getLanguagesDisplayString,
  getSectorDisplayString,
  getCountryDisplayString
} from 'js/assetUtils';
import {ASSET_TYPES} from 'js/constants';
import {
  t,
  notify,
  formatTime
} from 'js/utils';

/**
 * @prop asset
 */
class AssetInfoBox extends React.Component {
  constructor(props){
    super(props);
    this.state = {
      isPublicPending: false,
      isAwaitingFreshPermissions: false,
      areDetailsVisible: false
    };
    autoBind(this);
  }

  componentDidMount() {
    this.listenTo(actions.permissions.setAssetPublic.completed, this.onSetAssetPublicCompleted);
    this.listenTo(actions.permissions.setAssetPublic.failed, this.onSetAssetPublicFailed);
  }

  componentWillReceiveProps() {
    this.setState({isAwaitingFreshPermissions: false});
  }

  toggleDetails() {
    this.setState({areDetailsVisible: !this.state.areDetailsVisible});
  }

  onSetAssetPublicCompleted(assetUid) {
    if (this.props.asset.uid === assetUid) {
      this.setState({
        isPublicPending: false,
        isAwaitingFreshPermissions: true,
      });
    }
  }

  onSetAssetPublicFailed(assetUid) {
    if (this.props.asset.uid === assetUid) {
      this.setState({isPublicPending: false});
      notify(t('Failed to change asset public status.'), 'error');
    }
  }

  makePublic() {
    const requiredPropsReady = isAssetPublicReady(
      this.props.asset.name,
      this.props.asset.settings.organization,
      this.props.asset.settings.sector
    );

    if (requiredPropsReady === true) {
      this.setState({isPublicPending: true});
      actions.permissions.setAssetPublic(this.props.asset, true);
    } else {
      notify(Object.values(requiredPropsReady).join(' '), 'error');
    }
  }

  makePrivate() {
    this.setState({isPublicPending: true});
    actions.permissions.setAssetPublic(this.props.asset, false);
  }

  isSetPublicButtonDisabled() {
    return this.state.isPublicPending || this.state.isAwaitingFreshPermissions;
  }

  render() {
    if (!this.props.asset) {
      return null;
    }

    const isPublicable = this.props.asset.asset_type === ASSET_TYPES.collection.id;
    const isPublic = isPublicable && isAssetPublic(this.props.asset.permissions);

    return (
      <bem.FormView__cell m='box'>
        <bem.FormView__cell m={['columns', 'padding']}>
          <bem.FormView__cell m={['date', 'column-1']}>
            <bem.FormView__cellLabel>
              {t('Last Modified')}
            </bem.FormView__cellLabel>

            {formatTime(this.props.asset.date_modified)}
          </bem.FormView__cell>

          <bem.FormView__cell m={['questions', 'column-1']}>
            {this.props.asset.asset_type === ASSET_TYPES.collection.id &&
              <React.Fragment>
                <bem.FormView__cellLabel>
                  {t('Assets')}
                </bem.FormView__cellLabel>
                {this.props.asset.children.count || 0}
              </React.Fragment>
            }
            {this.props.asset.asset_type !== ASSET_TYPES.collection.id &&
              <React.Fragment>
                <bem.FormView__cellLabel>
                  {t('Questions')}
                </bem.FormView__cellLabel>
                {this.props.asset.summary.row_count || 0}
              </React.Fragment>
            }
          </bem.FormView__cell>

          {isPublicable &&
            <bem.FormView__cell m={['buttons', 'column-1']}>
              {!isPublic &&
                <button
                  className='mdl-button mdl-button--raised mdl-button--colored'
                  onClick={this.makePublic}
                  disabled={this.isSetPublicButtonDisabled()}
                >
                  {t('Make public')}
                </button>
              }
              {isPublic &&
                <button
                  className='mdl-button mdl-button--raised mdl-button--colored'
                  onClick={this.makePrivate}
                  disabled={this.isSetPublicButtonDisabled()}
                >
                  {t('Make private')}
                </button>
              }
            </bem.FormView__cell>
          }
        </bem.FormView__cell>

        <bem.FormView__cell m={['columns', 'padding', 'bordertop']}>
          <bem.FormView__cell m={['organization', 'column-1']}>
            <bem.FormView__cellLabel>
              {t('Organization')}
            </bem.FormView__cellLabel>

            {getOrganizationDisplayString(this.props.asset)}
          </bem.FormView__cell>

          <bem.FormView__cell m={['tags', 'column-1']}>
            <bem.FormView__cellLabel>
              {t('Tags')}
            </bem.FormView__cellLabel>

            {this.props.asset.settings.tags && this.props.asset.settings.tags.join(', ') || t('n/a')}
          </bem.FormView__cell>

          <bem.FormView__cell m={['sector', 'column-1']}>
            <bem.FormView__cellLabel>
              {t('Sector')}
            </bem.FormView__cellLabel>

            {getSectorDisplayString(this.props.asset)}
          </bem.FormView__cell>

          <bem.FormView__cell m={['country', 'column-1']}>
            <bem.FormView__cellLabel>
              {t('Country')}
            </bem.FormView__cellLabel>

            {getCountryDisplayString(this.props.asset, true)}
          </bem.FormView__cell>
        </bem.FormView__cell>

        {this.state.areDetailsVisible &&
          <React.Fragment>
            <bem.FormView__cell m={['columns', 'padding', 'bordertop']}>
              <bem.FormView__cell m={['languages', 'column-1']}>
                <bem.FormView__cellLabel>
                  {t('Languages')}
                </bem.FormView__cellLabel>

                {getLanguagesDisplayString(this.props.asset)}
              </bem.FormView__cell>

              <bem.FormView__cell m={['description', 'column-2']}>
                <bem.FormView__cellLabel>
                  {t('Description')}
                </bem.FormView__cellLabel>

                {this.props.asset.settings.description || t('n/a')}
              </bem.FormView__cell>
            </bem.FormView__cell>

            <bem.FormView__cell m={['columns', 'padding', 'bordertop']}>
              <bem.FormView__cell m='column-1'>
                <bem.FormView__cellLabel>
                  {t('Owner')}
                </bem.FormView__cellLabel>

                {getAssetOwnerDisplayName(this.props.asset.owner__username)}
              </bem.FormView__cell>

              <bem.FormView__cell m='column-1'>
                <bem.FormView__cellLabel>
                  {t('Member since')}
                </bem.FormView__cellLabel>

                TODO
              </bem.FormView__cell>
            </bem.FormView__cell>
          </React.Fragment>
        }

        <bem.FormView__cell m={['bordertop', 'toggle-details']}>
          <button onClick={this.toggleDetails}>
            {this.state.areDetailsVisible ? <i className='k-icon k-icon-up'/> : <i className='k-icon k-icon-down'/>}
            {this.state.areDetailsVisible ? t('Hide full details') : t('Show full details')}
          </button>
        </bem.FormView__cell>
      </bem.FormView__cell>
    );
  }
}

reactMixin(AssetInfoBox.prototype, Reflux.ListenerMixin);

export default AssetInfoBox;
