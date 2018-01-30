import $ from 'jquery';
import React from 'react';
import PropTypes from 'prop-types';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import _ from 'underscore';
import bem from '../bem';
import stores from '../stores';
import { Link, hashHistory } from 'react-router'; 
import mixins from '../mixins';

import {
  t,
  assign,
} from '../utils';

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
        { a.deployment__identifier != undefined && a.has_deployment && this.userCan('view_submissions', a) && 
          <Link 
            to={`/forms/${this.state.assetid}/summary`}
            className='form-view__tab'
            activeClassName='active'>
            {t('Summary')}
          </Link>
        }
        <Link 
          to={`/forms/${this.state.assetid}/landing`}
          className='form-view__tab'
          activeClassName='active'>
          {t('Form')}
        </Link>
        <bem.FormView__tab className="is-edge" m='summary'>
          {t('Summary')}
        </bem.FormView__tab>
        { a.deployment__identifier != undefined && a.has_deployment && a.deployment__submission_count > 0 && this.userCan('view_submissions', a) && 
          <Link 
            to={`/forms/${this.state.assetid}/data`}
            className='form-view__tab'
            activeClassName='active'>
            {t('Data')}
          </Link>
        }
        {this.userCan('change_asset', a) && 
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
  }
  renderFormSideTabs() {
    var sideTabs = [];

    if (this.state.asset && this.state.asset.has_deployment && this.isActiveRoute(`/forms/${this.state.assetid}/data`)) {
     sideTabs = [
        {label: t('Reports'), icon: 'k-icon-report', path: `/forms/${this.state.assetid}/data/report`},
        {label: t('Reports (legacy)'), icon: 'k-icon-report', path: `/forms/${this.state.assetid}/data/report-legacy`, className: 'is-edge'},
        {label: t('Table'), icon: 'k-icon-table', path: `/forms/${this.state.assetid}/data/table`},
        {label: t('Gallery'), icon: 'k-icon-photo-gallery', path: `/forms/${this.state.assetid}/data/gallery`},
        {label: t('Downloads'), icon: 'k-icon-download', path: `/forms/${this.state.assetid}/data/downloads`},
        {label: t('Map'), icon: 'k-icon-map-view', path: `/forms/${this.state.assetid}/data/map`},
      ];
    }

    // if (this.state.asset && this.state.asset.deployment__active && this.isActiveRoute(`/forms/${this.state.assetid}/settings`)) {
       // sideTabs = [
       //    {label: t('General settings'), icon: 'k-icon-information', path: `/forms/${this.state.assetid}/settings`},
       //    {label: t('Sharing'), icon: 'k-icon-share', path: `/forms/${this.state.assetid}/settings/sharing`},
       //    {label: t('Kobocat settings'), icon: 'k-icon-projects', path: `/forms/${this.state.assetid}/settings/kobocat`}
       //  ];
    // }

    if (sideTabs.length > 0) {
    	return (
    		<bem.FormView__sidetabs> 
          { sideTabs.map((item, ind) => 
            <Link 
              to={item.path}
              key={ind} 
              activeClassName='active'
              onlyActiveOnIndex={true}
              className={`form-view__tab ${item.className}`}
              data-path={item.path}
              onClick={this.triggerRefresh}>
                <i className={item.icon} />
                {item.label}
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
