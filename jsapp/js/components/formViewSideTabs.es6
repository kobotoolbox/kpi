import React from 'react';
import PropTypes from 'prop-types';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import bem from 'js/bem';
import assetStore from 'js/assetStore';
import {NavLink} from 'react-router-dom';
import mixins from '../mixins';
import {PERMISSIONS_CODENAMES} from 'js/constants';
import {ROUTES} from 'js/router/routerConstants';
import {withRouter} from 'js/router/legacy';
import {assign} from 'utils';
import {userCan} from 'js/components/permissions/utils';

export function getFormDataTabs(assetUid) {
  return [
    {
      label: t('Table'),
      icon: 'k-icon k-icon-table',
      path: ROUTES.FORM_TABLE.replace(':uid', assetUid),
    },
    {
      label: t('Reports'),
      icon: 'k-icon k-icon-reports',
      path: ROUTES.FORM_REPORT.replace(':uid', assetUid),
    },
    {
      label: t('Gallery'),
      icon: 'k-icon k-icon-gallery',
      path: ROUTES.FORM_GALLERY.replace(':uid', assetUid),
    },
    {
      label: t('Downloads'),
      icon: 'k-icon k-icon-download',
      path: ROUTES.FORM_DOWNLOADS.replace(':uid', assetUid),
    },
    {
      label: t('Map'),
      icon: 'k-icon k-icon-map-view',
      path: ROUTES.FORM_MAP.replace(':uid', assetUid),
    },
  ];
}

class FormViewSideTabs extends Reflux.Component {
  constructor(props) {
    super(props);
    this.state = {};
    autoBind(this);
  }

  componentDidMount() {
    // On initial load use the possibly stored asset.
    this.setState({asset: assetStore.getAsset(this.currentAssetID())})
    this.listenTo(assetStore, this.assetLoad);
  }

  assetLoad(data) {
    var asset = data[this.currentAssetID()];
    this.setState(assign({asset: asset}));
  }

  triggerRefresh(evt) {
    if ($(evt.target).hasClass('active')) {
      // ROUTES.FORM_RESET
      this.props.router.navigate(`/forms/${this.state.asset.uid}/reset`);

      var path = evt.target.getAttribute('data-path');
      window.setTimeout(() => {
        this.props.router.navigate(path);
      }, 50);

      evt.preventDefault();
    }
  }

  renderFormSideTabs() {
    var sideTabs = [];

    if (
      this.state.asset &&
      this.state.asset.has_deployment &&
      this.isActiveRoute(ROUTES.FORM_DATA.replace(':uid', this.state.asset.uid))
    ) {
      sideTabs = getFormDataTabs(this.state.asset.uid);
    }

    if (
      this.state.asset &&
      this.isActiveRoute(ROUTES.FORM_SETTINGS.replace(':uid', this.state.asset.uid))
    ) {
      sideTabs = [];

      sideTabs.push({
        label: t('General'),
        icon: 'k-icon k-icon-settings',
        path: ROUTES.FORM_SETTINGS.replace(':uid', this.state.asset.uid),
      });

      if (
        userCan(
          PERMISSIONS_CODENAMES.change_asset,
          this.state.asset
        )
      ) {
        sideTabs.push({
          label: t('Media'),
          icon: 'k-icon k-icon-gallery',
          path: ROUTES.FORM_MEDIA.replace(':uid', this.state.asset.uid),
        });
      }

      if (
        userCan(
          PERMISSIONS_CODENAMES.manage_asset,
          this.state.asset
        )
      ) {
        sideTabs.push({
          label: t('Sharing'),
          icon: 'k-icon k-icon-user-share',
          path: ROUTES.FORM_SHARING.replace(':uid', this.state.asset.uid),
        });
      }

      if (
        userCan(
          PERMISSIONS_CODENAMES.manage_asset,
          this.state.asset
        )
      ) {
        sideTabs.push({
          label: t('Connect Projects'),
          icon: 'k-icon k-icon-attach',
          path: ROUTES.FORM_RECORDS.replace(':uid', this.state.asset.uid),
        });
      }

      if (
        (
          this.state.asset.deployment__active ||
          // REST services should be visible for archived forms but not drafts
          this.state.asset.deployed_versions.count > 0
        ) &&
        userCan(
          PERMISSIONS_CODENAMES.view_submissions,
          this.state.asset
        ) &&
        userCan(
          PERMISSIONS_CODENAMES.change_asset,
          this.state.asset
        )
      ) {
        sideTabs.push({
          label: t('REST Services'),
          icon: 'k-icon k-icon-data-sync',
          path: ROUTES.FORM_REST.replace(':uid', this.state.asset.uid),
        });
      }
    }

    if (sideTabs.length > 0) {
      return (
        <bem.FormView__sidetabs>
          {sideTabs.map((item, ind) => {
            let className = 'form-view__tab';
            if (item.isDisabled) {
              className += ' form-view__tab--disabled';
            }
            return (
              <NavLink
                to={item.path}
                key={ind}
                className={className}
                data-path={item.path}
                onClick={this.triggerRefresh}
                end
              >
                <i className={`k-icon ${item.icon}`} />
                <span className='form-view__tab-name'>
                  {item.label}
                </span>
              </NavLink>
            );
          })}
        </bem.FormView__sidetabs>
      );
    }

    return false;
  }

  render() {
    if (!this.props.show) {
      return false;
    }
    return this.renderFormSideTabs();
  }
}

reactMixin(FormViewSideTabs.prototype, Reflux.ListenerMixin);
reactMixin(FormViewSideTabs.prototype, mixins.contextRouter);

FormViewSideTabs.contextTypes = {
  router: PropTypes.object,
};

export default withRouter(FormViewSideTabs);
