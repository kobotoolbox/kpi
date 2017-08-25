import React from 'react';
import PropTypes from 'prop-types';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import _ from 'underscore';
import {dataInterface} from '../dataInterface';

import actions from '../actions';
import bem from '../bem';
import ui from '../ui';
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
      currentPage: 0,
      error: false
    };
    autoBind(this);    
    this.fetchData = this.fetchData.bind(this);
  }

  requestData(pageSize, page, sort) {
    dataInterface.getSubmissions(this.props.asset.uid, pageSize, page, sort).done((data) => {
      this.setState({
        loading: false,
        tableData: data
      })
      this._prepColumns(data);
    }).fail((error)=>{
      if (error.responseText)
        this.setState({error: error.responseText, loading: false});
      else if (error.statusText)
        this.setState({error: error.statusText, loading: false});
      else
        this.setState({error: t('Error: could not load data.'), loading: false});
    });
  }

  _prepColumns(data) {
		var uniqueKeys = Object.keys(data.reduce(function(result, obj) {
		  return Object.assign(result, obj);
		}, {}))

		var columns = [{
      Header: t(' '),
      accessor: '___submission-link',
      Cell: row => (
        <span onClick={this.launchSubmissionModal} data-sid={row.row._id}
              className='rt-link'>
          {t('Open')}
        </span>
      )
    }];
    var excludes = ['_uuid', '_xform_id_string', '__version__', '_attachments', '_notes', '_bamboo_dataset_id',
                    'formhub/uuid', 'meta/instanceID', '_tags', '_geolocation', '_submitted_by', '_status'];
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
    this.setState({ 
      loading: true,
      pageSize: state.pageSize,
      currentPage: state.page
    });
    this.requestData(state.pageSize, state.page * state.pageSize, state.sorted);
  }

  launchSubmissionModal (evt) {
    const sid = evt.target.getAttribute('data-sid');

    stores.pageState.showModal({
      type: 'submission',
      sid: sid,
      asset: this.props.asset
    });
  }

  render () {
    if (this.state.error) {
      return (
        <ui.Panel>
          <bem.Loading>
            <bem.Loading__inner>
              {this.state.error}
            </bem.Loading__inner>
          </bem.Loading>
        </ui.Panel>
        )
    }

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
            <button className="mdl-button mdl-button--icon report-button__print is-edge" 
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
          previousText={t('Prev')}
          nextText={t('Next')}
          loadingText={
            <span>
              <i className="fa k-spin fa-circle-o-notch" />
              {t('Loading...')}
            </span>
          }
          noDataText={t('No rows found')} // TODO: fix display
          pageText={t('Page')}
          ofText={t('of')}
          rowsText={t('rows')}
		  		/>
      </bem.FormView>
    );
  }
};

export default DataTable;
