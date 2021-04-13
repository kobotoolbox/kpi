import React from 'react';
import PropTypes from 'prop-types';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import {bem} from '../bem';
import {stores} from '../stores';
import { Link, hashHistory } from 'react-router';
import mixins from '../mixins';
import assetUtils from 'js/assetUtils';
import {
  PERMISSIONS_CODENAMES,
  ROUTES,
} from 'js/constants';
import {assign} from 'utils';

class FormViewTabs extends Reflux.Component {
  constructor(props){
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
    this.setState(assign({
        asset: asset,
        assetid: assetid
      }
    ));
  }
  triggerRefresh (evt) {
    if ($(evt.target).hasClass('active')) {
      hashHistory.push(`/forms/${this.state.assetid}/reset`);

      var path = evt.target.getAttribute('data-path');
      window.setTimeout(function(){
        hashHistory.push(path);
      }, 50);

      evt.preventDefault();
    }
  }
  renderTopTabs () {
    if (this.state.asset === undefined)
      return false;

    let a = this.state.asset;

    return (
      <bem.FormView__toptabs>
        { a.deployment__identifier != undefined && a.has_deployment && (this.userCan('view_submissions', a) || this.userCan('partial_submissions', a)) &&
          <Link
            to={ROUTES.FORM_SUMMARY.replace(':uid', this.state.assetid)}
            className='form-view__tab'
            activeClassName='active'>
            {t('Summary')}
          </Link>
        }
        <Link
          to={ROUTES.FORM_LANDING.replace(':uid', this.state.assetid)}
          className='form-view__tab'
          activeClassName='active'>
          {t('Form')}
        </Link>
        { a.deployment__identifier != undefined && a.has_deployment && a.deployment__submission_count > 0 && (this.userCan('view_submissions', a) || this.userCan('partial_submissions', a)) &&
          <Link
            to={ROUTES.FORM_DATA.replace(':uid', this.state.assetid)}
            className='form-view__tab'
            activeClassName='active'>
            {t('Data')}
          </Link>
        }
        {this.userCan('change_asset', a) &&
          <Link
            to={ROUTES.FORM_SETTINGS.replace(':uid', this.state.assetid)}
            className='form-view__tab'
            activeClassName='active'>
            {t('Settings')}
          </Link>
        }
        <Link
          to={ROUTES.FORMS}
          className='form-view__link form-view__link--close'>
          <i className='k-icon-close' />
        </Link>

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
      sideTabs = [
        {
          label: t("Reports"),
          icon: "k-icon-report",
          path: ROUTES.FORM_REPORT.replace(':uid', this.state.assetid),
        },
        {
          label: t("Table"),
          icon: "k-icon-table",
          path: ROUTES.FORM_TABLE.replace(':uid', this.state.assetid),
        },
        {
          label: t("Gallery"),
          icon: "k-icon-photo-gallery",
          path: ROUTES.FORM_GALLERY.replace(':uid', this.state.assetid),
        },
        {
          label: t("Downloads"),
          icon: "k-icon-download",
          path: ROUTES.FORM_DOWNLOADS.replace(':uid', this.state.assetid),
        },
        {
          label: t("Map"),
          icon: "k-icon-map-view",
          path: ROUTES.FORM_MAP.replace(':uid', this.state.assetid),
        },
      ];
    }

    if (
      this.state.asset &&
      this.isActiveRoute(ROUTES.FORM_SETTINGS.replace(':uid', this.state.assetid))
    ) {
      sideTabs = [];

      sideTabs.push({
        label: t("General"),
        icon: "k-icon-settings",
        path: ROUTES.FORM_SETTINGS.replace(':uid', this.state.assetid),
      });

      if (
        mixins.permissions.userCan(
          PERMISSIONS_CODENAMES.change_asset,
          this.state.asset
        )
      ) {
        sideTabs.push({
          label: t("Media"),
          icon: "k-icon-photo-gallery",
          path: ROUTES.FORM_MEDIA.replace(':uid', this.state.assetid),
        });
      }

      sideTabs.push({
        label: t("Sharing"),
        icon: "k-icon-user-share",
        path: ROUTES.FORM_SHARING.replace(':uid', this.state.assetid),
      });

      sideTabs.push({
        label: t("Connect Projects"),
        icon: "k-icon-attach",
        path: ROUTES.FORM_RECORDS.replace(':uid', this.state.assetid),
      });

      if (
        this.state.asset.deployment__active &&
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
          label: t("REST Services"),
          icon: "k-icon-data-sync",
          path: ROUTES.FORM_REST.replace(':uid', this.state.assetid),
        });
      }
    }

    if (sideTabs.length > 0) {
      return (
        <bem.FormView__sidetabs>
          { sideTabs.map((item, ind) =>
            <Link
              to={item.path}
              key={ind}
              activeClassName='active'
              onlyActiveOnIndex
              className='form-view__tab'
              data-path={item.path}
              onClick={this.triggerRefresh}>
                <i className={item.icon} />
                <label className='form-view__tab-label'>
                  {item.label}
                </label>
            </Link>
          )}
        </bem.FormView__sidetabs>
      );
    }

    return false;
  }
  render() {
    if (!this.props.show)
      return false;
    if (this.props.type == 'top') {
      return (
        this.renderTopTabs()
      );
    }
    if (this.props.type == 'side') {
      return (
        this.renderFormSideTabs()
      );
    }
  }

};

reactMixin(FormViewTabs.prototype, Reflux.ListenerMixin);
reactMixin(FormViewTabs.prototype, mixins.contextRouter);
reactMixin(FormViewTabs.prototype, mixins.permissions);

FormViewTabs.contextTypes = {
  router: PropTypes.object
};

export default FormViewTabs;
