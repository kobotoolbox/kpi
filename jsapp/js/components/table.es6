import React from 'react';
import PropTypes from 'prop-types';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import _ from 'underscore';
import {dataInterface} from '../dataInterface';

import actions from '../actions';
import bem from '../bem';
import stores from '../stores';
import mixins from '../mixins';

import ReactTable from 'react-table'

import {
  assign,
  t,
  log,
  notify,
} from '../utils';

export class DataTable extends React.Component {
  constructor(props){
    super(props);
    this.state = {
    	loading: false,
    	tableData: [],
    	columns: [],
      showExpandedTable: false,
      defaultPageSize: 30,
      pageSize: 30,
      pages: null,
      currentPage: 0
    };
    autoBind(this);    
    this.fetchData = this.fetchData.bind(this);
  }

  requestData(pageSize, page, sort) {
    // TEMPORARY hook-up to KC API (NOT FOR PRODUCTION)
    // Only works with --disable-web-security flag in browser
    dataInterface.getToken().done((t) => {
      if (t && t.token) {
        var kc_server = document.createElement('a');
        kc_server.href = this.props.asset.deployment__identifier;
        let kc_url = kc_server.origin;

        if (this.props.asset.uid) {
          let uid = this.props.asset.uid;
          dataInterface.getKCForm(kc_url, t.token, uid).done((form) => {
            if (form && form.length === 1) {
              form = form[0];
              dataInterface.getKCFormData(kc_url, t.token, form.formid, pageSize, page, sort).done((data) => {
                this.setState({
                  loading: false,
                  tableData: data
                })

                this._prepColumns(data);

              }).fail((failData)=>{
                console.log(failData);
              });
            }
          }).fail((failData)=>{
            console.log(failData);
          });
        }
      }
    }).fail((failData)=>{
      console.log(failData);
    });
  }

  _prepColumns(data) {
		var uniqueKeys = Object.keys(data.reduce(function(result, obj) {
		  return Object.assign(result, obj);
		}, {}))

		var columns = [];
    var excludes = ['_uuid', '_xform_id_string', '__version__', '_attachments', '_notes', '_bamboo_dataset_id',
                    'formhub/uuid', 'meta/instanceID', '_tags', '_geolocation', '_submitted_by'];
    uniqueKeys.forEach(function(key){
    	if (!excludes.includes(key)) {
      	columns.push({
  	    	Header: key,
    	  	accessor: key
	      });
    	}
    });

    columns.sort(function(a, b) {
      return a.accessor.localeCompare(b.accessor);
    })

		this.setState({
			columns: columns
		})

  }

  toggleExpandedTable () {
    stores.pageState.hideDrawerAndHeader(!this.state.showExpandedTable);
    this.setState({
      showExpandedTable: !this.state.showExpandedTable,
    });
  }

  componentWillUnmount() {
    if (this.state.showExpandedTable)
      stores.pageState.hideDrawerAndHeader(!this.state.showExpandedTable);
  }

  launchPrinting () {
    window.print();
  }

  fetchData(state, instance) {
    // Whenever the table model changes, or the user sorts or changes pages, this method gets called and passed the current table model.
    // You can set the `loading` prop of the table to true to use the built-in one or show you're own loading bar if you want.
    this.setState({ 
      loading: true,
      pageSize: state.pageSize,
      currentPage: state.page
    });
    // Request the data however you want.  Here, we'll use our mocked service we created earlier
    // console.log(state.sorted);
    this.requestData(state.pageSize, state.page * state.pageSize, state.sorted);
    // this.requestData(state.pageSize,state.page,state.sorted,state.filtered);
  }

  render () {
    const { tableData, columns, defaultPageSize, loading, pageSize, currentPage } = this.state;
    const pages = Math.floor(((this.props.asset.deployment__submission_count - 1) / pageSize) + 1);
    const res1 = (currentPage * pageSize) + 1;
    const res2 = Math.min((currentPage + 1) * pageSize, this.props.asset.deployment__submission_count);
    const showingResults = `${res1} - ${res2}`;

    return (
      <bem.FormView m='table'>
        <bem.FormView__group m="table-header">
          <bem.FormView__item m='table-meta'>
            {`${showingResults} `}
            {t('of')}
            {` ${this.props.asset.deployment__submission_count} `}
            {t('results')}
          </bem.FormView__item>
          <bem.FormView__item m='table-buttons'>
            <button className="mdl-button mdl-button--icon report-button__print" 
                    onClick={this.launchPrinting} 
                    data-tip={t('Print')}>
              <i className="k-icon-print" />
            </button>

            <button className="mdl-button mdl-button--icon report-button__expand"
                    onClick={this.toggleExpandedTable} 
                    data-tip={t('Expand')}>
              <i className="k-icon-expand" />
            </button>   
          </bem.FormView__item>
        </bem.FormView__group>

	  		<ReactTable
  	  		data={tableData}
    			columns={columns}
          defaultPageSize={defaultPageSize}
          pageSizeOptions={[30, 50, 100, 200, 500]}
          minRows={1}
          className={"-striped -highlight"}
          pages={pages}
          manual
          onFetchData={this.fetchData}
          loading={loading}
		  		/>
      </bem.FormView>
    );
  }
};

export default DataTable;
