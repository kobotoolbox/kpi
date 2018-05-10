import React from 'react';
import PropTypes from 'prop-types';
import Reflux from 'reflux';
import reactMixin from 'react-mixin';
import bem from '../bem';
import ui from '../ui';
import actions from '../actions';
import stores from '../stores';
import mixins from '../mixins';
import Select from 'react-select';
import autoBind from 'react-autobind';

import {
  t,
  notify
} from '../utils';

export class TableColumnFilter extends React.Component {
  constructor(props){
    super(props);
    this.state = {
      selectedColumns: [],
      frozenColumn: false
    };

    if (props.settings['data-table'] && props.settings['data-table']['selected-columns']) {
      this.state.selectedColumns = props.settings['data-table']['selected-columns'];
    }

    if (props.settings['data-table'] && props.settings['data-table']['frozen-column']) {
      this.state.frozenColumn = props.settings['data-table']['frozen-column'];
    }

    autoBind(this);
  }
  componentDidMount() {
    this.listenTo(actions.table.updateSettings.failed, this.settingsUpdateFailed);
  }
  toggleCheckboxChange(evt) {
    let selectedColumns = this.state.selectedColumns,
        id = evt.target.value,
        idx = selectedColumns.indexOf(id);

    if (idx !== -1) {
      selectedColumns.splice(idx, 1);
    } else {
      selectedColumns.push(id);
    }

    this.setState({
      selectedColumns: selectedColumns
    })
  }
  saveTableColumns() {
    let s = this.state;
    let settings = this.props.settings;
    if (!settings['data-table']) {
      settings['data-table'] = {
        'selected-columns': s.selectedColumns,
        'frozen-column': s.frozenColumn
      };
    } else {
      settings['data-table']['selected-columns'] = s.selectedColumns.length > 0 ? s.selectedColumns : null;
      settings['data-table']['frozen-column'] = s.frozenColumn;
    }

    actions.table.updateSettings(this.props.uid, settings);
  }
  setFrozenColumn(col) {
    this.setState({
      frozenColumn: col && col.value ? col.value : false
    })
  }
  settingsUpdateFailed() {
    notify(t('There was an error, table settings could not be saved.'));
  }
  resetTableSettings() {
    let settings = this.props.settings;
    if (settings['data-table'])
      delete settings['data-table'];

    actions.table.updateSettings(this.props.uid, settings);
  }
  listColumns() {
    let colsArray = this.props.columns.reduce((acc, col) => {
      if (col.id) {
        let qParentGroup = [];
        if (col.id.includes('/')) {
          qParentGroup = col.id.split('/');
        }

        acc.push({
          value: col.id,
          label: this.props.getColumnLabel(col.id, col.question, qParentGroup)
        });
      }
      return acc;
    }, []);

    return colsArray;
  }
  render () {
    let _this = this;

    return (
      <div className="tableColumn-modal">
        {t('Select columns to be included in the table display.')}<br/>
        <label>{t('Note: only users with edit permissions can see this screen.')}</label>
        <ul>
          {this.listColumns().map(function(col) {
            return (
              <li key={col.value}>
                <input
                  type="checkbox"
                  value={col.value}
                  checked={_this.state.selectedColumns.includes(col.value)}
                  onChange={_this.toggleCheckboxChange}
                  id={`colcheck-${col.value}`}
                />

                <label htmlFor={`colcheck-${col.value}`}>
                  {col.label}
                </label>
              </li>
            );
          })}
        </ul>
        {t('Select a column to be displayed as the first, frozen column in the table.')}
        <Select
          value={this.state.frozenColumn}
          options={this.listColumns()}
          onChange={this.setFrozenColumn} />
        <div className='tableColumn-modal--footer'>
          <button className="mdl-button mdl-button--colored" onClick={this.resetTableSettings}>
            {t('Reset')}
          </button>

          <button className="mdl-button mdl-button--raised mdl-button--colored"
                  onClick={this.saveTableColumns}>
            {t('Save')}
          </button>
        </div>

      </div>
    )
  }
}

reactMixin(TableColumnFilter.prototype, Reflux.ListenerMixin);

export default TableColumnFilter;
