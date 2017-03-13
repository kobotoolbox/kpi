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
    console.log(currentRoutes);
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
            className={this.state.activeRoute == '/forms/:assetid/reports' ? 'active' : ''} 
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
  	console.log(this.state);
  	return (
  		<bem.FormView__sidetabs> 
	        { this.state.activeRouteName && this.state.activeRouteName == 'form-reports' && 
            <bem.FormView__tabs>
                <bem.FormView__tab m={'report-in-kpi'}
                    href={this.makeHref('form-reports', {assetid: this.state.assetid})}>
                  <i className="k-icon-report" />
                  {t('Reports')}
                </bem.FormView__tab>
                <bem.FormView__tab m={'report'}
                    href={this.makeHref('form-data-report', {assetid: this.state.assetid})}
                    className="is-edge">
                  <i className="k-icon-report" />
                  {t('Reports (legacy)')}
                </bem.FormView__tab>
                <bem.FormView__tab m={'table'}
                    href={this.makeHref('form-data-table', {assetid: this.state.assetid})}>
                  <i className="k-icon-table" />
                  {t('Table')}
                </bem.FormView__tab>
                <bem.FormView__tab m={'gallery'}
                    href={this.makeHref('form-data-gallery', {assetid: this.state.assetid})}>
                  <i className="k-icon-photo-gallery" />
                  {t('Gallery')}
                </bem.FormView__tab>
                <bem.FormView__tab m={'downloads'}
                    href={this.makeHref('form-data-downloads', {assetid: this.state.assetid})}>
                  <i className="k-icon-download" />
                  {t('Downloads')}
                </bem.FormView__tab>
                <bem.FormView__tab m={'map'}
                    href={this.makeHref('form-data-map', {assetid: this.state.assetid})}>
                  <i className="k-icon-map-view" />
                  {t('Map')}
                </bem.FormView__tab>
            </bem.FormView__tabs>
          }

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
