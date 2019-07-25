import React from 'react';
import autoBind from 'react-autobind';
import bem from 'js/bem';
import stores from 'js/stores';
import actions from 'js/actions';
import {
  ASSET_TYPES,
  MODAL_TYPES
} from 'js/constants';
import {
  t,
  formatTime,
  anonUsername
} from 'js/utils';
import {
  isLibraryAssetPublic,
  isLibraryAssetPublicReady
} from 'js/components/modalForms/modalHelpers';

class AssetInfoBox extends React.Component {
  constructor(props){
    super(props);
    this.state = {
      isPublicPending: false,
      areDetailsVisible: false
    };
    autoBind(this);
  }

  componentWillReceiveProps() {
    this.setState({isPublicPending: false});
  }

  toggleDetails() {
    this.setState({areDetailsVisible: !this.state.areDetailsVisible});
  }

  makePublic() {
    const requiredPropsReady = isLibraryAssetPublicReady(
      this.props.asset.name,
      this.props.asset.settings.organization,
      this.props.asset.settings.sector
    );

    if (requiredPropsReady === true) {
      actions.permissions.assignPerm({
        // TODO: change to constant after #2259 is closed
        username: anonUsername,
        uid: this.props.asset.uid,
        kind: this.props.asset.kind,
        objectUrl: this.props.asset.object_url,
        // TODO: change to constant after #2259 is closed
        role: 'view'
      });
      this.setState({isPublicPending: true});
    } else {
      this.showDetailsModalForced();
    }
  }

  showDetailsModalForced() {
    let modalType;
    if (this.props.asset.asset_type === ASSET_TYPES.template.id) {
      modalType = MODAL_TYPES.LIBRARY_TEMPLATE;
    } else if (this.props.asset.asset_type === ASSET_TYPES.collection.id) {
      modalType = MODAL_TYPES.LIBRARY_COLLECTION;
    }
    stores.pageState.showModal({
      type: modalType,
      asset: this.props.asset,
      forceMakePublic: true
    });
  }

  makePrivate() {
    let permUrl;
    this.props.asset.permissions.forEach((perm) => {
      // TODO: change to constant after #2259 is closed
      if (perm.user__username === anonUsername) {
        permUrl = perm.url;
      }
    });

    actions.permissions.removePerm({
      permission_url: permUrl,
      content_object_uid: this.props.asset.uid
    });
    this.setState({isPublicPending: true});
  }

  render() {
    if (!this.props.asset) {
      return null;
    }

    const isPublicable = (
      this.props.asset.asset_type === ASSET_TYPES.template.id ||
      this.props.asset.asset_type === ASSET_TYPES.collection.id
    );

    const isPublic = isLibraryAssetPublic(
      this.props.asset.permissions,
      this.props.asset.discoverable_when_public
    );

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
            <bem.FormView__cellLabel>
              {t('Questions')}
            </bem.FormView__cellLabel>

            {this.props.asset.summary.row_count || 0}
          </bem.FormView__cell>

          {isPublicable &&
            <bem.FormView__cell m={['buttons', 'column-1']}>
              {!isPublic &&
                <button
                  className='mdl-button mdl-button--raised mdl-button--colored'
                  onClick={this.makePublic}
                  disabled={this.state.isPublicPending}
                >
                  {t('Make public')}
                </button>
              }
              {isPublic &&
                <button
                  className='mdl-button mdl-button--raised mdl-button--colored'
                  onClick={this.makePrivate}
                  disabled={this.state.isPublicPending}
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

            {this.props.asset.settings.organization || t('n/a')}
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

            {this.props.asset.settings.sector && this.props.asset.settings.sector.value || t('n/a')}
          </bem.FormView__cell>

          <bem.FormView__cell m={['country', 'column-1']}>
            <bem.FormView__cellLabel>
              {t('Country')}
            </bem.FormView__cellLabel>

            {this.props.asset.settings.country && this.props.asset.settings.country.value || t('n/a')}
          </bem.FormView__cell>
        </bem.FormView__cell>

        {this.state.areDetailsVisible &&
          <React.Fragment>
            <bem.FormView__cell m={['columns', 'padding', 'bordertop']}>
              <bem.FormView__cell m={['languages', 'column-1']}>
                <bem.FormView__cellLabel>
                  {t('Languages')}
                </bem.FormView__cellLabel>

                {this.props.asset.content.translations && this.props.asset.content.translations.join(', ') || t('n/a')}
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

                {this.props.asset.owner__username}
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

export default AssetInfoBox;
