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
      frozenColumn: false,
      showGroupName: true,
      translationIndex: 0
    };

    if (props.settings['data-table']) {
      if (props.settings['data-table']['selected-columns'])
        this.state.selectedColumns = props.settings['data-table']['selected-columns'];
      if (props.settings['data-table']['frozen-column'])
        this.state.frozenColumn = props.settings['data-table']['frozen-column'];
      if (props.settings['data-table']['show-group-name'])
        this.state.showGroupName = props.settings['data-table']['show-group-name'];
      if (props.settings['data-table']['translation-index'])
        this.state.translationIndex = props.settings['data-table']['translation-index'];
    }

    autoBind(this);
  }
  componentDidMount() {
    this.listenTo(actions.table.updateSettings.failed, this.settingsUpdateFailed);
  }
  saveTableColumns() {
    let s = this.state;
    let settings = this.props.settings;
    if (!settings['data-table']) {
      settings['data-table'] = {};
    }

    settings['data-table']['selected-columns'] = s.selectedColumns.length > 0 ? s.selectedColumns : null;
    settings['data-table']['frozen-column'] = s.frozenColumn;
    settings['data-table']['show-group-name'] = s.showGroupName;
    settings['data-table']['translation-index'] = s.translationIndex;

    actions.table.updateSettings(this.props.uid, settings);
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
  setFrozenColumn(col) {
    this.setState({
      frozenColumn: col && col.value ? col.value : false
    })
  }
  updateGroupHeaderDisplay(e) {
    this.setState({
      showGroupName: e.target.checked
    })
  }
  onLabelChange(e) {
    this.setState({
      translationIndex: e.target.value
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
      if (col.id && col.id !== '__SubmissionLinks') {
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
        <bem.FormModal__item m='translation-radios'>
          <bem.FormView__cell m='label'>
            {t('Display labels or XML values?')}
          </bem.FormView__cell>
          <div>
            <label htmlFor={`trnsl-xml`}>
              <input type='radio' name='translation'
                     value='-1' id={`trnsl-xml`}
                     checked={this.state.translationIndex == '-1'}
                     onChange={this.onLabelChange} />
              {t('XML Values')}
            </label>

            {
              this.props.translations.map((trns, n) => {
                return (
                  <label htmlFor={`trnsl-${n}`} key={n}>
                    <input type='radio' name='translation'
                           value={n} id={`trnsl-${n}`}
                           checked={this.state.translationIndex == n}
                           onChange={this.onLabelChange} />
                    {t('Labels')} {trns ? ` - ${trns}` : null}
                  </label>
                )
              })
            }

          </div>
        </bem.FormModal__item>
        <bem.FormModal__item>
          <bem.FormView__cell m='label'>
            {t('Set one column as a frozen first column in the table.')}
          </bem.FormView__cell>
          <Select
            value={this.state.frozenColumn}
            options={this.listColumns()}
            onChange={this.setFrozenColumn} />
        </bem.FormModal__item>
        <bem.FormModal__item>
          <bem.FormView__cell m='label'>
            {t('Choose which columns to include in the table display (by default, all columns are shown).')}
          </bem.FormView__cell>
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
        </bem.FormModal__item>
        <bem.FormModal__item m='group-headings'>
          <input
            type="checkbox"
            checked={this.state.showGroupName}
            onChange={this.updateGroupHeaderDisplay}
            id='check-group-headings'/>
          <label htmlFor='check-group-headings'>
            {t('Show group names in table headers')}
          </label>
        </bem.FormModal__item>
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
