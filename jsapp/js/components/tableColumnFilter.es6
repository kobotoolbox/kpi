import _ from 'underscore';
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
      showHXLTags: false,
      translationIndex: 0
    };

    let _sett = props.asset.settings;
    if (_sett['data-table']) {
      if (_sett['data-table']['selected-columns'])
        this.state.selectedColumns = _sett['data-table']['selected-columns'];
      if (_sett['data-table']['frozen-column']) {
        const cols = this.listColumns();
        this.state.frozenColumn = _.find(cols, (col) => {return col.value === _sett['data-table']['frozen-column']});
      }
      if (_sett['data-table']['show-group-name'])
        this.state.showGroupName = _sett['data-table']['show-group-name'];
      if (_sett['data-table']['translation-index'])
        this.state.translationIndex = _sett['data-table']['translation-index'];
      if (_sett['data-table']['show-hxl-tags'])
        this.state.showHXLTags = _sett['data-table']['show-hxl-tags'];
    }

    autoBind(this);
  }
  componentDidMount() {
    this.listenTo(actions.table.updateSettings.failed, this.settingsUpdateFailed);
  }
  saveTableColumns() {
    let s = this.state;
    let settings = this.props.asset.settings;
    if (!settings['data-table']) {
      settings['data-table'] = {};
    }

    if (this.userCan('change_asset', this.props.asset)) {
      settings['data-table']['selected-columns'] = s.selectedColumns.length > 0 ? s.selectedColumns : null;
      settings['data-table']['frozen-column'] = s.frozenColumn.value;
      settings['data-table']['show-group-name'] = s.showGroupName;
      settings['data-table']['translation-index'] = s.translationIndex;
      settings['data-table']['show-hxl-tags'] = s.showHXLTags;

      actions.table.updateSettings(this.props.asset.uid, settings);
    } else {
      console.log('just update the state, since user cannot save settings');
      let overrides = {
        showGroupName: s.showGroupName,
        translationIndex: s.translationIndex
      }

      this.props.overrideLabelsAndGroups(overrides);
    }
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
      frozenColumn: col ? col : false
    })
  }
  updateGroupHeaderDisplay(e) {
    this.setState({
      showGroupName: e.target.checked
    })
  }
  onHXLTagsChange(evt) {
    this.setState({
      showHXLTags: evt.currentTarget.checked
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
    let settings = this.props.asset.settings;
    if (settings['data-table'])
      delete settings['data-table'];

    actions.table.updateSettings(this.props.asset.uid, settings);
  }
  listColumns() {
    let stateOverrides = {
      showGroupName: this.state.showGroupName,
      translationIndex: this.state.translationIndex
    }
    let colsArray = this.props.columns.reduce((acc, col) => {
      if (col.id && col.id !== '__SubmissionLinks' && col.id !== '__SubmissionCheckbox') {
        let qParentGroup = [];
        if (col.id.includes('/')) {
          qParentGroup = col.id.split('/');
        }

        acc.push({
          value: col.id,
          label: this.props.getColumnLabel(col.id, col.question, qParentGroup, stateOverrides)
        });
      }
      return acc;
    }, []);

    return colsArray;
  }
  render () {
    let _this = this;

    return (
      <div className='tableColumn-modal'>
        <bem.FormModal__item m='translation-radios'>
          <bem.FormView__cell m='label'>
            {t('Display labels or XML values?')}
          </bem.FormView__cell>
          <div>
            <label htmlFor={'trnsl-xml'}>
              <input type='radio' name='translation'
                     value='-1' id={'trnsl-xml'}
                     checked={this.state.translationIndex == '-1'}
                     onChange={this.onLabelChange} />
              {t('XML Values')}
            </label>
            {
              this.props.asset.content.translations.map((trns, n) => {
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
        <bem.FormModal__item m='group-headings'>
          <input
            type='checkbox'
            checked={this.state.showGroupName}
            onChange={this.updateGroupHeaderDisplay}
            id='check-group-headings'/>
          <label htmlFor='check-group-headings'>
            {t('Show group names in table headers')}
          </label>
        </bem.FormModal__item>

        <bem.FormModal__item>
          <input
            type='checkbox'
            checked={this.state.showHXLTags}
            onChange={this.onHXLTagsChange}
            id='hxl-tags'
          />
          <label htmlFor='hxl-tags'>
            {t('Show HXL tags')}
          </label>
        </bem.FormModal__item>

        {this.userCan('change_asset', this.props.asset) &&
          <bem.FormModal__item m='advanced-table-options'>
            <bem.FormView__cell m='note'>
              {t('Note: Only users with the "edit form" permission can see the following two options. If other users can view submissions on this project, their table view will be restricted by the choices made below.')}
            </bem.FormView__cell>
            <bem.FormModal__item>
              <bem.FormView__cell m='label'>
                {t('Set a frozen first column in the table.')}
              </bem.FormView__cell>
              <Select
                value={this.state.frozenColumn}
                options={this.listColumns()}
                onChange={this.setFrozenColumn}
                className='kobo-select'
                classNamePrefix='kobo-select'
                menuPlacement='auto'
                isClearable
              />
            </bem.FormModal__item>
            <bem.FormModal__item>
              <bem.FormView__cell m='label'>
                {t('Restrict the visible columns in the table display')}
                <span>{t('All columns are visible by default')}</span>
              </bem.FormView__cell>
              <ul>
                {this.listColumns().map(function(col) {
                  return (
                    <li key={col.value}>
                      <input
                        type='checkbox'
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
          </bem.FormModal__item>
        }
        <bem.Modal__footer>
          {this.userCan('change_asset', this.props.asset) &&
            <bem.Modal__footerButton m='secondary' onClick={this.resetTableSettings}>
              {t('Reset')}
            </bem.Modal__footerButton>
          }

          <bem.Modal__footerButton m='primary' onClick={this.saveTableColumns}>
            {t('Save')}
          </bem.Modal__footerButton>
        </bem.Modal__footer>

      </div>
    )
  }
}

reactMixin(TableColumnFilter.prototype, Reflux.ListenerMixin);
reactMixin(TableColumnFilter.prototype, mixins.permissions);

export default TableColumnFilter;
