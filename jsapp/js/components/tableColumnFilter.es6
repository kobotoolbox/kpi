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
    if (this.state.selectedColumns.length === 0) {
      notify(t('You must select at least one column.'));
      return false;
    }
    let settings = this.props.settings;
    if (!settings['data-table']) {
      settings['data-table'] = {
        'selected-columns': this.state.selectedColumns
      };
    } else {
      settings['data-table']['selected-columns'] = this.state.selectedColumns;
    }

    actions.table.updateSettings(this.props.uid, settings);
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

  render () {
    let _this = this;

    return (
      <div className="tableColumn-modal">
        {t('Select which columns to include in the table display and press Save below to store your changes.')}&nbsp;
        <strong>{t('Note: only users who can edit this project can see this screen and show/hide table columns.')}</strong>
        <ul>
          {
            this.props.columns.map(function(col, ind) {
              if (col.id) {
                let qParentGroup = [];
                if (col.id.includes('/')) {
                  qParentGroup = col.id.split('/');
                }

                return (
                  <li className="checkbox" key={col.id}>
                    <input
                      type="checkbox"
                      value={col.id}
                      checked={_this.state.selectedColumns.includes(col.id)}
                      onChange={_this.toggleCheckboxChange}
                      id={`colcheck-${col.id}`}
                    />

                    <label htmlFor={`colcheck-${col.id}`}>
                      {_this.props.getColumnLabel(col.id, col.question, qParentGroup)}
                    </label>
                  </li>
                );
              }
            })
          }
        </ul>
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
