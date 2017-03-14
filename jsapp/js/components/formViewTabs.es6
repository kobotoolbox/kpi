import React from 'react/addons';
import Reflux from 'reflux';
import _ from 'underscore';
import {
  Navigation,
} from 'react-router';
import bem from '../bem';
import stores from '../stores';
import mdl from '../libs/rest_framework/material';

import {
  t,
  assign,
} from '../utils';

var FormViewTabs = React.createClass({
  mixins: [
    Reflux.connect(stores.session),
    Reflux.connect(stores.pageState),
    Reflux.ListenerMixin,
    Navigation
  ],
  getInitialState() {
    var dataTabs = ['form-reports', 'form-data-report', 'form-data-table', 'form-data-gallery', 'form-data-downloads', 'form-data-map'];
    var formTabs = [];
    var settingsTabs = [];
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
    var currentParams = this.context.router.getCurrentParams();
    this.setState(assign(currentParams));

    var currentRoutes = this.context.router.getCurrentRoutes();
    var activeRoute = currentRoutes[currentRoutes.length - 1];
    this.setState({
      activeRoute: activeRoute.path,
      activeRouteName: activeRoute.name
    });

    this.listenTo(stores.asset, this.assetLoad);
  },
  assetLoad(data) {
    var asset = data[this.state.assetid];
    this.setState(assign({
        asset: asset
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
    var activeRoute = this.state.activeRouteName;
    return (
      <bem.FormView__toptabs>
        <bem.FormView__tab 
          m='form' 
          className={this.state.activeRoute == '/forms/:assetid' ? 'active' : ''} 
          href={this.makeHref('form-landing', {assetid: this.state.assetid})}
          data-id='Form'>
            {t('Form')}
        </bem.FormView__tab>
        <bem.FormView__tab className="is-edge" m='summary'>
          {t('Summary')}
        </bem.FormView__tab>
        { this.state.asset && this.state.asset.deployment__identifier != undefined && this.state.asset.has_deployment && this.state.asset.deployment__submission_count > 0 && 
          <bem.FormView__tab 
            m='data' 
            className={this.state.dataTabs.indexOf(activeRoute) > -1 ? 'active' : ''} 
            href={this.makeHref('form-reports', {assetid: this.state.assetid})}
            data-id='Data'>
              {t('Data')}
          </bem.FormView__tab>
        }
        {this.userCanEditAsset() && 
          <bem.FormView__tab 
            m='settings' 
            className={this.state.activeRoute == '/forms/:assetid/data/settings' ? 'active' : ''} 
            href={this.makeHref('form-data-settings', {assetid: this.state.assetid})}>
              {t('Settings')}
          </bem.FormView__tab>
        }
      </bem.FormView__toptabs>
    );
  },
  renderFormSideTabs() {
  	var activeRoute = this.state.activeRouteName;
    var sideTabs = [];

    if (activeRoute != undefined && this.state.dataTabs.indexOf(activeRoute) > -1 ) {
     sideTabs = [
        {label: t('Reports'), icon: 'k-icon-report', path: 'form-reports'},
        {label: t('Reports (legacy)'), icon: 'k-icon-report', path: 'form-data-report', className: 'is-edge'},
        {label: t('Table'), icon: 'k-icon-table', path: 'form-data-table'},
        {label: t('Gallery'), icon: 'k-icon-photo-gallery', path: 'form-data-gallery'},
        {label: t('Downloads'), icon: 'k-icon-download', path: 'form-data-downloads'},
        {label: t('Map'), icon: 'k-icon-map-view', path: 'form-data-map'},
      ];
    }

  	return (
  		<bem.FormView__sidetabs> 
        { sideTabs.map((item, ind) => 
          <bem.FormView__tab
              key={ind} 
              className={[item.className, activeRoute == item.path ? 'active' : '']}
              href={this.makeHref(item.path, {assetid: this.state.assetid})} >
            <i className={item.icon} />
            {item.label}
          </bem.FormView__tab>
        )}
  		</bem.FormView__sidetabs>
  	);
  },
  render() {
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
