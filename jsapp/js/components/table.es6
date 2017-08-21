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
    	loading: true,
    	tableData: [],
    	columns: [],
      showExpandedTable: false,
      totalResults: 0,
      showingResults: '1 - 30',
      defaultPageSize: 30
    };
    autoBind(this);

  }
  componentDidMount() {
    this.requestData();
  }

  requestData() {
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
              dataInterface.getKCFormData(kc_url, t.token, form.formid).done((data) => {
                this.setState({
                  loading: false,
                  tableData: data,
                  totalResults: data.length
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
      alert('failed token');
    });
  }

  _prepColumns(data) {
		var uniqueKeys = Object.keys(data.reduce(function(result, obj) {
		  return Object.assign(result, obj);
		}, {}))

		var columns = [];
    uniqueKeys.forEach(function(key){
    	if (key.includes('/')) {
    		// exclude these
    	} else {
      	columns.push({
  	    	Header: key,
    	  	accessor: key
	      });
    	}
    });

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

  render () {
  	if (this.state.loading) {
	    return (
	      <bem.Loading>
	        <bem.Loading__inner>
	          <i />
	          {t('loading...')}
	        </bem.Loading__inner>
	      </bem.Loading>
	    );  		
  	}

    const { tableData, columns, defaultPageSize } = this.state;

    return (
      <bem.FormView m='table'>
        <bem.FormView__group m="table-header">
          <bem.FormView__item m='table-meta'>
            {`${this.state.showingResults} `}
            {t('of')}
            {` ${this.state.totalResults} `}
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
          filterable
          pageSizeOptions={[30, 50, 100]}
          minRows={1}
          className={"-striped -highlight"}
		  		/>
      </bem.FormView>
    );
  }
};

export default DataTable;
