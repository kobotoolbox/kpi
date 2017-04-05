import React from 'react';
import Reflux from 'reflux';
import _ from 'underscore';
import bem from '../bem';
import stores from '../stores';
import mdl from '../libs/rest_framework/material';
import { Link } from 'react-router'; 
import mixins from '../mixins';

import {
  t,
  assign,
} from '../utils';

var FormViewTabs = React.createClass({
  mixins: [
    Reflux.connect(stores.session, 'session'),
    Reflux.connect(stores.pageState, 'pageState'),
    Reflux.ListenerMixin,
    mixins.contextRouter
  ],
  getInitialState() {
    var dataTabs = ['form-reports', 'form-data-report', 'form-data-table', 'form-data-gallery', 'form-data-downloads', 'form-data-map'];
    var formTabs = ['form-landing', 'form-collect-web', 'form-collect-android'];
    var settingsTabs = ['form-settings', 'form-settings-sharing', 'form-settings-kobocat'];
    return {
      dataTabs: dataTabs,
      formTabs: formTabs,
      settingsTabs: settingsTabs
    };
  },
  componentWillMount() {
    this.setStates();
  },
  componentWillReceiveProps() {
    this.setStates();
  },
  setStates() {
    this.listenTo(stores.asset, this.assetLoad);
  },
  assetLoad(data) {
    var assetid = this.currentAssetID();
    var asset = data[assetid];
    this.setState(assign({
        asset: asset,
        assetid: assetid
      }
    ));
  },
  userCanEditAsset() {
    if (stores.session.currentAccount && this.state.asset) {
      const currentAccount = stores.session.currentAccount;
      if (currentAccount.is_superuser || currentAccount.username == this.state.asset.owner__username || this.state.asset.access.change[currentAccount.username])
        return true;
    }

    return false;
  },
  renderTopTabs () {
    return (
      <bem.FormView__toptabs>
        <Link 
          to={`/forms/${this.state.assetid}/landing`}
          className='form-view__tab'
          activeClassName='active'>
          {t('Form')}
        </Link>
        <bem.FormView__tab className="is-edge" m='summary'>
          {t('Summary')}
        </bem.FormView__tab>
        { this.state.asset && this.state.asset.deployment__identifier != undefined && this.state.asset.has_deployment && this.state.asset.deployment__submission_count > 0 && 
          <Link 
            to={`/forms/${this.state.assetid}/data/report`}
            className='form-view__tab'
            activeClassName='active'>
            {t('Data')}
          </Link>
        }
        {this.userCanEditAsset() && 
          <Link 
            to={`/forms/${this.state.assetid}/settings`}
            className='form-view__tab'
            activeClassName='active'>
            {t('Settings')}
          </Link>
        }

        <Link 
          to={`/forms`}
          className='form-view__link form-view__link--close'>
          <i className="k-icon-close" />
        </Link>

      </bem.FormView__toptabs>
    );
  },
  renderFormSideTabs() {
    var sideTabs = [];

    if (this.state.asset && this.state.asset.deployment__active && this.isActiveRoute(`/forms/${this.state.assetid}/data`)) {
     sideTabs = [
        {label: t('Reports'), icon: 'k-icon-report', path: `/forms/${this.state.assetid}/data/report`},
        {label: t('Reports (legacy)'), icon: 'k-icon-report', path: `/forms/${this.state.assetid}/data/report-legacy`, className: 'is-edge'},
        {label: t('Table'), icon: 'k-icon-table', path: `/forms/${this.state.assetid}/data/table`},
        {label: t('Gallery'), icon: 'k-icon-photo-gallery', path: `/forms/${this.state.assetid}/data/gallery`},
        {label: t('Downloads'), icon: 'k-icon-download', path: `/forms/${this.state.assetid}/data/downloads`},
        {label: t('Map'), icon: 'k-icon-map-view', path: `/forms/${this.state.assetid}/data/map`},
      ];
    }

    if (this.state.asset && this.state.asset.deployment__active && this.isActiveRoute(`/forms/${this.state.assetid}/landing`)) {
       sideTabs = [
          {label: t('Form overview'), icon: 'k-icon-form-overview', path: `/forms/${this.state.assetid}/landing`},
          {label: t('Collect data'), icon: 'k-icon-webform', path: `/forms/${this.state.assetid}/landing/collect`},
          {label: t('Android app'), icon: 'k-icon-mobile-form', path: `/forms/${this.state.assetid}/landing/android`}
        ];
    }

    if (this.state.asset && this.state.asset.deployment__active && this.isActiveRoute(`/forms/${this.state.assetid}/settings`)) {
       sideTabs = [
          {label: t('General settings'), icon: 'k-icon-information', path: `/forms/${this.state.assetid}/settings`},
          {label: t('Sharing'), icon: 'k-icon-share', path: `/forms/${this.state.assetid}/settings/sharing`},
          {label: t('Kobocat settings'), icon: 'k-icon-projects', path: `/forms/${this.state.assetid}/settings/kobocat`}
        ];
    }

    if (sideTabs.length > 0) {
    	return (
    		<bem.FormView__sidetabs> 
          { sideTabs.map((item, ind) => 
            <Link 
              to={item.path}
              key={ind} 
              activeClassName='active'
              onlyActiveOnIndex={true}
              className={`form-view__tab ${item.className}`}>
                <i className={item.icon} />
                {item.label}
            </Link>
          )}
    		</bem.FormView__sidetabs>
    	);
    }

    return false;
  },
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
  },
  componentDidUpdate() {
    mdl.upgradeDom();
  }

})

export default FormViewTabs;
