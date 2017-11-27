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
  formatTimeDate
} from '../utils';

export class DataTable extends React.Component {
  constructor(props){
    super(props);
    this.state = {
    	loading: true,
    	tableData: [],
    	columns: [],
      sids: [],
      showExpandedTable: false,
      defaultPageSize: 30,
      pageSize: 30,
      pages: null,
      currentPage: 0,
      error: false,
      showLabels: true,
      showGroups: true
    };
    autoBind(this);    
    this.fetchData = this.fetchData.bind(this);
  }

  requestData(pageSize, page, sort) {
    dataInterface.getSubmissions(this.props.asset.uid, pageSize, page, sort).done((data) => {
      if (data && data.length > 0) {
        this.setState({
          loading: false,
          tableData: data
        })
        this._prepColumns(data);
      } else {
        this.setState({error: t('Error: could not load data.'), loading: false});
      }

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

    let showLabels = this.state.showLabels;
    let showGroups = this.state.showGroups;

		var columns = [{
      Header: '',
      accessor: 'sub-link',
      index: '__1',
      minWidth: 50,
      Cell: row => (
        <span onClick={this.launchSubmissionModal} data-sid={row.row._id}
              className='rt-link'>
          {t('Open')}
        </span>
      )
    }];
    var excludes = ['_xform_id_string', '_attachments', '_notes', '_bamboo_dataset_id', '_status',
                    'formhub/uuid', '_tags', '_geolocation', '_submitted_by', 'meta/instanceID'];

    let survey = this.props.asset.content.survey;
    let choices = this.props.asset.content.choices;

    uniqueKeys.forEach(function(key){
      if (excludes.includes(key)) 
        return false;

      var q = undefined;
      var groupQ = [];
      if (key.includes('/')) {
        groupQ = key.split('/');
        q = survey.find(o => o.name === groupQ[1] || o.$autoname == groupQ[1]);
      } else {
        q = survey.find(o => o.name === key || o.$autoname == key);
      }

      var index = key;

      switch(key) {
        case 'username':
            index = 'z1';
            break;
        case 'simserial':
            index = 'z2';
            break;
        case 'subscriberid':
            index = 'z3';
            break;
        case 'deviceid':
            index = 'z4';
            break;
        case 'phonenumber':
            index = 'z5';
            break;
        case 'today':
            index = 'z6';
            break;
        case '__version__':
            index = 'z7';
            break;
        case '_id':
            index = 'z8';
            break;
        case '_uuid':
            index = 'z9';
            break;
        case '_submission_time':
            index = 'z91';
            break;
        default:
          survey.map(function(x, i) {
            if (x.name === key || x.$autoname === key) {
              index = 'f' + i.toString();
            }
          });
      }

    	columns.push({
	    	Header: h => {
            var lbl = key.includes('/') ? key.split('/')[1] : key;
            if (q && q.label && showLabels)
              lbl = q.label[0];
            // show Groups in labels, when selected
            if (showGroups && groupQ && key.includes('/') && key !== 'meta/instanceID')
              lbl = `${groupQ[0]} / ${lbl}`;

            return lbl;
          },
  	  	accessor: key,
        index: index,
        question: q,
        Cell: row => {
            if (showLabels && q && q.type && row.value) {
              // show proper labels for choice questions
              if (q.type == 'select_one') {
                let choice = choices.find(o => o.list_name == q.select_from_list_name && (o.name === row.value || o.$autoname == row.value));
                return choice && choice.label ? choice.label[0] : row.value;
              }
              if (q.type == 'select_multiple' && row.value) {
                let values = row.value.split(" ");
                var labels = [];
                values.forEach(function(v) {
                  let choice = choices.find(o => o.list_name == q.select_from_list_name && (o.name === v || o.$autoname == v));
                  labels.push(choice.label[0]);
                });

                return labels.join(", ");
              }
              if (q.type == 'start' || q.type == 'end' || q.type == '_submission_time') {
                return formatTimeDate(row.value);
              }
            }
            return row.value;
          }
      });

    });

    columns.sort(function(a, b) {
      return a.index.localeCompare(b.index);
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
    const td = this.state.tableData;
    var ids = [];
    td.forEach(function(r) {
      ids.push(r._id);
    })

    stores.pageState.showModal({
      type: 'submission',
      sid: sid,
      asset: this.props.asset,
      ids: ids
    });
  }

  toggleLabels () {
    this.setState({
      showLabels: !this.state.showLabels
    });

    window.setTimeout(()=>{
      this._prepColumns(this.state.tableData);
    }, 300);
  }

  toggleGroups () {
    this.setState({
      showGroups: !this.state.showGroups
    });

    window.setTimeout(()=>{
      this._prepColumns(this.state.tableData);
    }, 300);

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
        <bem.FormView__group m={['table-header', this.state.loading ? 'table-loading' : 'table-loaded']}>
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
                    data-tip={this.state.showExpandedTable ? t('Contract') : t('Expand')}>
              <i className="k-icon-expand" />
            </button>   

            <ui.PopoverMenu type='formTable-menu' 
                        triggerLabel={<i className="k-icon-more" />} 
                        triggerTip={t('More Actions')}>
                <bem.PopoverMenu__link onClick={this.toggleLabels}>
                  {t('Toggle labels / XML values')}
                </bem.PopoverMenu__link>
                <bem.PopoverMenu__link onClick={this.toggleGroups}>
                  {t('Show/hide question groups')}
                </bem.PopoverMenu__link>
            </ui.PopoverMenu>

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
