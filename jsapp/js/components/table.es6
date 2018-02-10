import React from 'react';
import PropTypes from 'prop-types';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import reactMixin from 'react-mixin';
import _ from 'underscore';
import {dataInterface} from '../dataInterface';

import actions from '../actions';
import bem from '../bem';
import ui from '../ui';
import stores from '../stores';
import mixins from '../mixins';
import alertify from 'alertifyjs';

import ReactTable from 'react-table'
import Select from 'react-select';
import {DebounceInput} from 'react-debounce-input';

import {
  VALIDATION_STATUSES
} from '../constants';

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
      showGroups: true,
      resultsTotal: 0,
      selectedRows: {},
      selectAll: false,
      fetchState: false
    };
    autoBind(this);    
  }
  requestData(instance) {
    let pageSize = instance.state.pageSize, 
        page = instance.state.page * instance.state.pageSize, 
        sort = instance.state.sorted, 
        filter = instance.state.filtered, 
        filterQuery = '';

    if (filter.length) {
      filterQuery = `&query={`;
      filter.forEach(function(f, i) {
        filterQuery += `"${f.id}":{"$regex":"${f.value}"}`;
        if (i < filter.length - 1)
          filterQuery += ',';
      });
      filterQuery += `}`;
      dataInterface.getSubmissions(this.props.asset.uid, pageSize, page, sort, [], filterQuery, true).done((data) => {
        if (data.count) {
          this.setState({resultsTotal: data.count});
        }
      });
    } else {
      this.setState({resultsTotal: this.props.asset.deployment__submission_count});
    }

    dataInterface.getSubmissions(this.props.asset.uid, pageSize, page, sort, [], filterQuery).done((data) => {
      if (data && data.length > 0) {
        this.setState({
          loading: false,
          selectedRows: {},
          selectAll: false,
          tableData: data
        })
        this._prepColumns(data);
      } else {
        if (filterQuery.length) {
          this.setState({
            loading: false
          });
          // TODO: debounce the queries and then enable this notification
          notify(t('The query did not return any results.'));
        } else {
          this.setState({error: t('Error: could not load data.'), loading: false});
        }
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
  validationStatusChange(sid, index) {
    var _this = this;

    return function(selection) {
      const data = {"validation_status.uid": selection.value};
      dataInterface.updateSubmissionValidationStatus(_this.props.asset.uid, sid, data).done((result) => {
        if (result.uid) {
          _this.state.tableData[index]._validation_status = result.uid;
          _this.setState({tableData: _this.state.tableData});
        } else {
          console.error('error updating validation status');
        }
      }).fail((error)=>{
        console.error(error);
      });
    }
  }
  _prepColumns(data) {
		var uniqueKeys = Object.keys(data.reduce(function(result, obj) {
		  return Object.assign(result, obj);
		}, {}))

    let showLabels = this.state.showLabels;
    let showGroups = this.state.showGroups;
    let maxPageRes = Math.min(this.state.pageSize, this.state.tableData.length);

    var columns = [];

    if (this.userCan('validate_submissions', this.props.asset)) {
      columns.push({
        Header: row => (
            <div className="table-header-checkbox">
              <input type="checkbox"
                id={`ch-head`}
                checked={Object.keys(this.state.selectedRows).length === maxPageRes ? true : false}
                onChange={this.bulkSelectAllRows} />
              <label htmlFor={`ch-head`}></label>
            </div>
          ),
        accessor: 'sub-checkbox',
        index: '__0',
        minWidth: 45,
        filterable: false,
        sortable: false,
        Cell: row => (
          <div>
            <input type="checkbox"
                id={`ch-${row.row._id}`}
                checked={this.state.selectedRows[row.row._id] ? true : false}
                onChange={this.bulkUpdateChange} data-sid={row.row._id} />
            <label htmlFor={`ch-${row.row._id}`}></label>
          </div>
        )
      });
    }

    columns.push({
      Header: '',
      accessor: 'sub-link',
      index: '__1',
      minWidth: 50,
      filterable: false,
      sortable: false,
      Cell: row => (
        <span onClick={this.launchSubmissionModal} data-sid={row.row._id}
              className='rt-link'>
          {t('Open')}
        </span>
      )
    });

    columns.push({
      Header: t('Validation status'),
      accessor: '_validation_status.uid',
      index: '__2',
      minWidth: 130,
      className: 'rt-status',
      Filter: ({ filter, onChange }) =>
        <select
          onChange={event => onChange(event.target.value)}
          style={{ width: "100%" }}
          value={filter ? filter.value : ""}>
          <option value="">Show All</option>
          {VALIDATION_STATUSES.map((item, n) => {
            return (
              <option value={item.value} key={n}>{item.label}</option>
            );
          })}
        </select>,
      Cell: row => (
        <Select 
          disabled={!this.userCan('validate_submissions', this.props.asset)}
          clearable={false}
          value={this.state.tableData[row.index]._validation_status}
          options={VALIDATION_STATUSES}
          onChange={this.validationStatusChange(row.row._id, row.index)}>
        </Select>
      )
    });

    var excludes = ['_xform_id_string', '_attachments', '_notes', '_bamboo_dataset_id', '_status',
                    'formhub/uuid', '_tags', '_geolocation', '_submitted_by', 'meta/instanceID','_validation_status'];

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

      if (q && q.type === 'begin_repeat')
        return false;

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
        id: key,
        accessor: row => row[key],
        index: index,
        question: q,
        filterable: false,
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
                  if (choice && choice.label && choice.label[0])
                    labels.push(choice.label[0]);
                });

                return labels.join(", ");
              }
              if (q.type == 'start' || q.type == 'end' || q.type == '_submission_time') {
                return formatTimeDate(row.value);
              }
            }
            return typeof(row.value) == "object" ? '' : row.value;
          }
      });

    });

    columns.sort(function(a, b) {
      return a.index.localeCompare(b.index);
    })

    columns.forEach(function(col, ind) {
      // TODO: see if this can work for select_multiple too
      if (col.question && col.question.type === 'select_one') {
        columns[ind].filterable = true;
        columns[ind].Filter = ({ filter, onChange }) =>
          <select
            onChange={event => onChange(event.target.value)}
            style={{ width: "100%" }}
            value={filter ? filter.value : ""}>
            <option value="">Show All</option>
            {choices.filter(c => c.list_name === col.question.select_from_list_name).map((item, n) => {
              return (
                <option value={item.name} key={n}>{item.label[0]}</option>
              );
            })}
          </select>;
      }
      if (col.question && (col.question.type === 'text' || col.question.type === 'integer'
          || col.question.type === 'decimal')) {
        columns[ind].filterable = true;
        columns[ind].Filter = ({ filter, onChange }) =>
          <DebounceInput
            debounceTimeout={750}
            onChange={event => onChange(event.target.value)}
            style={{ width: "100%" }}/>;
      }
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
  componentDidMount() {
    this.listenTo(actions.resources.updateSubmissionValidationStatus.completed, this.refreshSubmission);
  }
  componentWillUnmount() {
    if (this.state.showExpandedTable)
      stores.pageState.hideDrawerAndHeader(!this.state.showExpandedTable);
  }
  refreshSubmission(result, sid) {
    if (sid) {
      var subIndex = this.state.tableData.findIndex(x => x._id === parseInt(sid));
      if (typeof subIndex !== "undefined" && this.state.tableData[subIndex]) {
        var newData = this.state.tableData;
        newData[subIndex]._validation_status = result;
        this.setState({tableData: newData});
        this._prepColumns(newData);
      }
    }
  }
  launchPrinting () {
    window.print();
  }
  fetchData(state, instance) {
    this.setState({ 
      loading: true,
      pageSize: instance.state.pageSize,
      currentPage: instance.state.page,
      fetchState: state,
      fetchInstance: instance
    });
    this.requestData(instance);
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
  bulkUpdateChange(evt) {
    const sid = evt.target.getAttribute('data-sid');
    var selectedRows = this.state.selectedRows;

    if (evt.target.checked) {
      selectedRows[sid] = true;
    } else {
      delete selectedRows[sid];
    }

    this.setState({
      selectedRows: selectedRows,
      selectAll: false
    });
  }
  bulkSelectAllRows(evt) {
    var s = this.state.selectedRows,
        selectAll = this.state.selectAll;

    this.state.tableData.forEach(function(r) {
      if (evt.target.checked) {
        s[r._id] = true;
      } else {
        delete s[r._id];
      }
    })

    this.setState({
      selectedRows: s,
      selectAll: false
    });
  }
  bulkUpdateStatus(evt) {
    const val = evt.target.getAttribute('data-value'),
          selectAll = this.state.selectAll;
    var d = null;

    if (!selectAll) {
      d = {
        submissions_ids: Object.keys(this.state.selectedRows),
        "validation_status.uid": val
      };
    } else {
      const f = this.state.fetchState.filtered;
      if (f.length) {
        d = {
          query: {},
          "validation_status.uid": val
        };
        f.forEach(function(z) {
          d.query[z.id] = z.value;
        });
      } else {
        d = {
          confirm: true,
          "validation_status.uid": val
        };
      }
    }

    let dialog = alertify.dialog('confirm');
    const sel = this.state.selectAll ? this.state.resultsTotal : Object.keys(this.state.selectedRows).length;
    let opts = {
      title: t('Update status of selected submissions'),
      message: t('You have selected ## submissions. Are you sure you would like to update their status? This action is irreversible.').replace('##', sel),
      labels: {ok: t('Update Validation Status'), cancel: t('Cancel')},
      onok: (evt, val) => {
        dataInterface.patchSubmissions(this.props.asset.uid, d).done((res) => {
          this.fetchData(this.state.fetchState, this.state.fetchInstance);
          this.setState({loading: true});
        }).fail((jqxhr)=> {
          console.error(jqxhr);
          alertify.error(t('Failed to update status.'));
        });
      },
      oncancel: () => {
        dialog.destroy();
      }
    };
    dialog.set(opts).show();
  }
  toggleLabels() {
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
  bulkSelectAll() {
    this.setState({selectAll: true});
  }
  clearSelection() {
    this.setState({selectAll: false, selectedRows: {}});
  }
  bulkSelectUI() {
    if (!this.state.tableData.length) {
      return false;
    }

    const { pageSize, currentPage, resultsTotal } = this.state;

    const pages = Math.floor(((resultsTotal - 1) / pageSize) + 1), 
          res1 = (currentPage * pageSize) + 1, 
          res2 = Math.min((currentPage + 1) * pageSize, resultsTotal), 
          showingResults = `${res1} - ${res2} ${t('of')} ${resultsTotal} ${t('results')}. `,
          selected = this.state.selectedRows,
          maxPageRes = Math.min(this.state.pageSize, this.state.tableData.length);;

          // 
    return (
      <bem.FormView__item m='table-meta'>
        {showingResults}
        {this.state.selectAll ? 
          <span>
            {t('All ## selected. ').replace('##', resultsTotal)}
            <a className="select-all" onClick={this.clearSelection}>
              {t('Clear selection')}
            </a>
          </span>
        :
          <span>
            {Object.keys(selected).length > 0 &&
              t('## selected. ').replace('##', Object.keys(selected).length)
            }
            {Object.keys(selected).length == maxPageRes && resultsTotal > pageSize &&
              <a className="select-all" onClick={this.bulkSelectAll}>
                {t('Select all ##').replace('##', resultsTotal)}
              </a>
            }
          </span>
        }
      </bem.FormView__item>
    );
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

    const { tableData, columns, defaultPageSize, loading, pageSize, currentPage, resultsTotal } = this.state;
    const pages = Math.floor(((resultsTotal - 1) / pageSize) + 1);

    return (
      <bem.FormView m='table'>
        <bem.FormView__group m={['table-header', this.state.loading ? 'table-loading' : 'table-loaded']}>
          {this.bulkSelectUI()}
          <bem.FormView__item m='table-buttons'>
            <button className="mdl-button mdl-button--icon report-button__print is-edge" 
                    onClick={this.launchPrinting} 
                    data-tip={t('Print')}>
              <i className="k-icon-print" />
            </button>

            {Object.keys(this.state.selectedRows).length > 0 &&
              <ui.PopoverMenu type='bulkUpdate-menu' triggerLabel={t('Update selected')} >
                <bem.PopoverMenu__heading>
                  {t('Updated status to:')}
                </bem.PopoverMenu__heading>
                {VALIDATION_STATUSES.map((item, n) => {
                  return (
                    <bem.PopoverMenu__link onClick={this.bulkUpdateStatus} data-value={item.value} key={n}>
                      {item.label}
                      </bem.PopoverMenu__link>
                  );
                })}
              </ui.PopoverMenu>
            }

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
          pageSizeOptions={[10, 30, 50, 100, 200, 500]}
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
          filterable
		  		/>
      </bem.FormView>
    );
  }
};

reactMixin(DataTable.prototype, Reflux.ListenerMixin);
reactMixin(DataTable.prototype, mixins.permissions);
export default DataTable;
