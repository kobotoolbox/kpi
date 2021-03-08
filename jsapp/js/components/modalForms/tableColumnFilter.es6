import _ from 'underscore';
import React from 'react';
import PropTypes from 'prop-types';
import Reflux from 'reflux';
import reactMixin from 'react-mixin';
import Select from 'react-select';
import autoBind from 'react-autobind';
import Checkbox from 'js/components/common/checkbox';
import Radio from 'js/components/common/radio';
import {bem} from 'js/bem';
import ui from 'js/ui';
import {actions} from 'js/actions';
import {stores} from 'js/stores';
import mixins from 'js/mixins';
import {notify} from 'utils';
import {SUBMISSION_LINKS_ID} from 'js/components/table';

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
      if (_sett['data-table']['selected-columns'] !== null)
        this.state.selectedColumns = _sett['data-table']['selected-columns'];
      if (typeof _sett['data-table']['frozen-column'] !== 'undefined') {
        const cols = this.listColumns();
        this.state.frozenColumn = _.find(cols, (col) => {return col.value === _sett['data-table']['frozen-column']});
      }
      if (typeof _sett['data-table']['show-group-name'] !== 'undefined')
        this.state.showGroupName = _sett['data-table']['show-group-name'];
      if (typeof _sett['data-table']['translation-index'] !== 'undefined')
        this.state.translationIndex = _sett['data-table']['translation-index'];
      if (typeof _sett['data-table']['show-hxl-tags'] !== 'undefined')
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
  toggleCheckboxChange(columnId) {
    const selectedColumns = this.state.selectedColumns;
    const idx = selectedColumns.indexOf(columnId);

    if (idx !== -1) {
      selectedColumns.splice(idx, 1);
    } else {
      selectedColumns.push(columnId);
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
  updateGroupHeaderDisplay(isChecked) {
    this.setState({
      showGroupName: isChecked
    })
  }
  onHXLTagsChange(isChecked) {
    this.setState({
      showHXLTags: isChecked
    })
  }
  onLabelChange(name, value) {
    this.setState({
      translationIndex: parseInt(value)
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
      if (col.id && col.id !== SUBMISSION_LINKS_ID && col.id !== '__SubmissionCheckbox') {
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

    colsArray.unshift({
      value: SUBMISSION_LINKS_ID,
      label: t('Submission links')
    });

    return colsArray;
  }
  getDisplayedLabelOptions () {
    const options = [];
    options.push({
      value: -1,
      label: t('XML Values')
    });
    this.props.asset.content.translations.map((trns, n) => {
      let label = t('Labels');
      if (trns) {
        label += ` - ${trns}`;
      }
      options.push({
        value: n,
        label: label
      });
    });
    return options;
  }
  render () {
    let _this = this;

    return (
      <div className='tableColumn-modal'>
        <bem.FormModal__item m='translation-radios'>
          <Radio
            title={t('Display labels or XML values?')}
            options={this.getDisplayedLabelOptions()}
            selected={this.state.translationIndex}
            onChange={this.onLabelChange}
          />
        </bem.FormModal__item>
        <bem.FormModal__item m='group-headings'>
          <Checkbox
            checked={this.state.showGroupName}
            onChange={this.updateGroupHeaderDisplay}
            label={t('Show group names in table headers')}
          />
        </bem.FormModal__item>

        <bem.FormModal__item>
          <Checkbox
            checked={this.state.showHXLTags}
            onChange={this.onHXLTagsChange}
            label={t('Show HXL tags')}
          />
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
                      <Checkbox
                        checked={_this.state.selectedColumns.includes(col.value)}
                        onChange={_this.toggleCheckboxChange.bind(this, col.value)}
                        label={col.label}
                      />
                    </li>
                  );
                })}
              </ul>
            </bem.FormModal__item>
          </bem.FormModal__item>
        }
        <bem.Modal__footer>
          {this.userCan('change_asset', this.props.asset) &&
            <bem.KoboButton m='whitegray' onClick={this.resetTableSettings}>
              {t('Reset')}
            </bem.KoboButton>
          }

          <bem.KoboButton m='blue' onClick={this.saveTableColumns}>
            {t('Save')}
          </bem.KoboButton>
        </bem.Modal__footer>

      </div>
    )
  }
}

reactMixin(TableColumnFilter.prototype, Reflux.ListenerMixin);
reactMixin(TableColumnFilter.prototype, mixins.permissions);

export default TableColumnFilter;
