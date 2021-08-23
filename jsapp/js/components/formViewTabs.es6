import React from 'react';
import PropTypes from 'prop-types';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import bem from 'js/bem';
import {stores} from '../stores';
import {Link, hashHistory} from 'react-router';
import mixins from '../mixins';
import {PERMISSIONS_CODENAMES} from 'js/constants';
import {ROUTES} from 'js/router/routerConstants';
import {assign} from 'utils';

export function getFormDataTabs(assetUid) {
  return [
    {
      label: t('Table'),
      icon: 'k-icon k-icon-table',
      path: ROUTES.FORM_TABLE.replace(':uid', assetUid),
    },
    {
      label: t('Reports'),
      icon: 'k-icon k-icon-report',
      path: ROUTES.FORM_REPORT.replace(':uid', assetUid),
    },
    {
      label: t('Gallery'),
      icon: 'k-icon k-icon-photo-gallery',
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

class FormViewTabs extends Reflux.Component {
  constructor(props) {
    super(props);
    this.state = {};
    autoBind(this);
  }

  componentDidMount() {
    this.listenTo(stores.asset, this.assetLoad);
  }

  assetLoad(data) {
    var assetid = this.currentAssetID();
    var asset = data[assetid];
    this.setState(
      assign({
        asset: asset,
        assetid: assetid,
      })
    );
  }

  triggerRefresh(evt) {
    if ($(evt.target).hasClass('active')) {
      hashHistory.push(`/forms/${this.state.assetid}/reset`);

      var path = evt.target.getAttribute('data-path');
      window.setTimeout(function () {
        hashHistory.push(path);
      }, 50);

      evt.preventDefault();
    }
  }

  isDataTabEnabled() {
    return (
      this.state.asset.deployment__identifier != undefined &&
      this.state.asset.has_deployment &&
      this.state.asset.deployment__submission_count > 0 &&
      (
        this.userCan('view_submissions', this.state.asset) ||
        this.userCanPartially('view_submissions', this.state.asset)
      )
    );
  }

  renderTopTabs() {
    if (this.state.asset === undefined) {
      return false;
    }

    let dataTabClassNames = 'form-view__tab';
    if (!this.isDataTabEnabled()) {
      dataTabClassNames += ' form-view__tab--disabled';
    }

    let summaryTabClassNames = 'form-view__tab';
    if (!stores.session.isLoggedIn) {
      summaryTabClassNames += ' form-view__tab--disabled';
    }

    let settingsTabClassNames = 'form-view__tab';
    if (
      !stores.session.isLoggedIn ||
      !this.userCan('change_asset', this.state.asset)
    ) {
      settingsTabClassNames += ' form-view__tab--disabled';
    }

    return (
      <bem.FormView__toptabs>
        <Link
          to={ROUTES.FORM_SUMMARY.replace(':uid', this.state.assetid)}
          className={summaryTabClassNames}
          activeClassName='active'
        >
          {t('Summary')}
        </Link>

        <Link
          to={ROUTES.FORM_LANDING.replace(':uid', this.state.assetid)}
          className='form-view__tab'
          activeClassName='active'
        >
          {t('Form')}
        </Link>

        <Link
          to={ROUTES.FORM_DATA.replace(':uid', this.state.assetid)}
          className={dataTabClassNames}
          activeClassName='active'
        >
          {t('Data')}
        </Link>

        <Link
          to={ROUTES.FORM_SETTINGS.replace(':uid', this.state.assetid)}
          className={settingsTabClassNames}
          activeClassName='active'
        >
          {t('Settings')}
        </Link>

        {stores.session.isLoggedIn && (
          <Link
            to={ROUTES.FORMS}
            className='form-view__link form-view__link--close'
          >
            <i className='k-icon k-icon-close' />
          </Link>
        )}
      </bem.FormView__toptabs>
    );
  }

  renderFormSideTabs() {
    var sideTabs = [];

    if (
      this.state.asset &&
      this.state.asset.has_deployment &&
      this.isActiveRoute(ROUTES.FORM_DATA.replace(':uid', this.state.assetid))
    ) {
      sideTabs = getFormDataTabs(this.state.assetid);
    }

    if (
      this.state.asset &&
      this.isActiveRoute(ROUTES.FORM_SETTINGS.replace(':uid', this.state.assetid))
    ) {
      sideTabs = [];

      sideTabs.push({
        label: t('General'),
        icon: 'k-icon k-icon-settings',
        path: ROUTES.FORM_SETTINGS.replace(':uid', this.state.assetid),
      });

      if (
        mixins.permissions.userCan(
          PERMISSIONS_CODENAMES.change_asset,
          this.state.asset
        )
      ) {
        sideTabs.push({
          label: t('Media'),
          icon: 'k-icon k-icon-photo-gallery',
          path: ROUTES.FORM_MEDIA.replace(':uid', this.state.assetid),
        });
      }

      sideTabs.push({
        label: t('Sharing'),
        icon: 'k-icon k-icon-user-share',
        path: ROUTES.FORM_SHARING.replace(':uid', this.state.assetid),
      });

      sideTabs.push({
        label: t('Connect Projects'),
        icon: 'k-icon k-icon-attach',
        path: ROUTES.FORM_RECORDS.replace(':uid', this.state.assetid),
      });

      if (
        (
          this.state.asset.deployment__active ||
          // REST services should be visible for archived forms but not drafts
          this.state.asset.deployed_versions.count > 0
        ) &&
        mixins.permissions.userCan(
          PERMISSIONS_CODENAMES.view_submissions,
          this.state.asset
        ) &&
        mixins.permissions.userCan(
          PERMISSIONS_CODENAMES.change_asset,
          this.state.asset
        )
      ) {
        sideTabs.push({
          label: t('REST Services'),
          icon: 'k-icon k-icon-data-sync',
          path: ROUTES.FORM_REST.replace(':uid', this.state.assetid),
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
              <Link
                to={item.path}
                key={ind}
                activeClassName='active'
                onlyActiveOnIndex
                className={className}
                data-path={item.path}
                onClick={this.triggerRefresh}
              >
                <i className={`k-icon ${item.icon}`} />
                {item.label}
              </Link>
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
    if (this.props.type === 'top') {
      return (
        this.renderTopTabs()
      );
    }
    if (this.props.type === 'side') {
      return (
        this.renderFormSideTabs()
      );
    }
  }
}

reactMixin(FormViewTabs.prototype, Reflux.ListenerMixin);
reactMixin(FormViewTabs.prototype, mixins.contextRouter);
reactMixin(FormViewTabs.prototype, mixins.permissions);

FormViewTabs.contextTypes = {
  router: PropTypes.object,
};

export default FormViewTabs;
