import _ from 'underscore';
import React from 'react';
import Reflux from 'reflux';
import reactMixin from 'react-mixin';
import Select from 'react-select';
import autoBind from 'react-autobind';
import clonedeep from 'lodash.clonedeep';
import Checkbox from 'js/components/common/checkbox';
import Radio from 'js/components/common/radio';
import {bem} from 'js/bem';
import {actions} from 'js/actions';
import mixins from 'js/mixins';
import {notify} from 'utils';
import {
  SUBMISSION_ACTIONS_ID,
  DATA_TABLE_SETTING,
  DATA_TABLE_SETTINGS,
} from 'js/components/submissions/tableConstants';
import {getColumnLabel} from 'js/components/submissions/tableUtils';
import './tableSettings.scss';

class TableSettings extends React.Component {
  constructor(props){
    super(props);
    this.state = {
      selectedColumns: [],
      frozenColumn: false,
      showGroupName: true,
      showHXLTags: false,
      translationIndex: 0,
    };

    let _sett = props.asset.settings;
    if (_sett[DATA_TABLE_SETTING]) {
      if (_sett[DATA_TABLE_SETTING][DATA_TABLE_SETTINGS.SELECTED_COLUMNS] !== null) {
        this.state.selectedColumns = _sett[DATA_TABLE_SETTING][DATA_TABLE_SETTINGS.SELECTED_COLUMNS];
      }
      if (typeof _sett[DATA_TABLE_SETTING][DATA_TABLE_SETTINGS.FROZEN_COLUMN] !== 'undefined') {
        const cols = this.listColumns();
        this.state.frozenColumn = _.find(cols, (col) => col.value === _sett[DATA_TABLE_SETTING][DATA_TABLE_SETTINGS.FROZEN_COLUMN]);
      }
      if (typeof _sett[DATA_TABLE_SETTING][DATA_TABLE_SETTINGS.SHOW_GROUP] !== 'undefined') {
        this.state.showGroupName = _sett[DATA_TABLE_SETTING][DATA_TABLE_SETTINGS.SHOW_GROUP];
      }
      if (typeof _sett[DATA_TABLE_SETTING][DATA_TABLE_SETTINGS.TRANSLATION] !== 'undefined') {
        this.state.translationIndex = _sett[DATA_TABLE_SETTING][DATA_TABLE_SETTINGS.TRANSLATION];
      }
      if (typeof _sett[DATA_TABLE_SETTING][DATA_TABLE_SETTINGS.SHOW_HXL] !== 'undefined') {
        this.state.showHXLTags = _sett[DATA_TABLE_SETTING][DATA_TABLE_SETTINGS.SHOW_HXL];
      }
    }

    autoBind(this);
  }

  componentDidMount() {
    this.listenTo(actions.table.updateSettings.failed, this.onUpdateSettingsFailed);
  }

  saveTableColumns() {
    let s = this.state;

    // get whole asset settings as clone to avoid bugs
    const newSettings = clonedeep(this.props.asset.settings);

    if (!newSettings[DATA_TABLE_SETTING]) {
      newSettings[DATA_TABLE_SETTING] = {};
    }

    if (this.userCan('change_asset', this.props.asset)) {
      newSettings[DATA_TABLE_SETTING][DATA_TABLE_SETTINGS.SELECTED_COLUMNS] = s.selectedColumns.length > 0 ? s.selectedColumns : null;
      newSettings[DATA_TABLE_SETTING][DATA_TABLE_SETTINGS.FROZEN_COLUMN] = s.frozenColumn.value;
      newSettings[DATA_TABLE_SETTING][DATA_TABLE_SETTINGS.SHOW_GROUP] = s.showGroupName;
      newSettings[DATA_TABLE_SETTING][DATA_TABLE_SETTINGS.TRANSLATION] = s.translationIndex;
      newSettings[DATA_TABLE_SETTING][DATA_TABLE_SETTINGS.SHOW_HXL] = s.showHXLTags;

      actions.table.updateSettings(this.props.asset.uid, newSettings);
    } else {
      // just update the state, since user cannot save settings
      let overrides = {
        showGroupName: s.showGroupName,
        translationIndex: s.translationIndex,
      };

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

    this.setState({selectedColumns: selectedColumns});
  }

  setFrozenColumn(col) {
    this.setState({frozenColumn: col ? col : false});
  }

  updateGroupHeaderDisplay(isChecked) {
    this.setState({showGroupName: isChecked});
  }

  onHXLTagsChange(isChecked) {
    this.setState({showHXLTags: isChecked});
  }

  onLabelChange(name, value) {
    this.setState({translationIndex: parseInt(value)});
  }

  onUpdateSettingsFailed() {
    notify(t('There was an error, table settings could not be saved.'));
  }

  resetTableSettings() {
    // get whole asset settings as clone to avoid bugs
    const newSettings = clonedeep(this.props.asset.settings);

    if (newSettings[DATA_TABLE_SETTING]) {
      delete newSettings[DATA_TABLE_SETTING];
    }

    actions.table.updateSettings(this.props.asset.uid, newSettings);
  }

  listColumns() {
    let colsArray = this.props.columns.reduce((acc, col) => {
      if (col.id && col.id !== SUBMISSION_ACTIONS_ID) {
        let qParentGroup = [];
        if (col.id.includes('/')) {
          qParentGroup = col.id.split('/');
        }

        acc.push({
          value: col.id,
          label: getColumnLabel(
            this.props.asset.content.survey,
            col.id,
            col.question,
            qParentGroup,
            this.state.showGroupName,
            this.state.translationIndex
          ),
        });
      }
      return acc;
    }, []);

    return colsArray;
  }

  getDisplayedLabelOptions() {
    const options = [];
    options.push({
      value: -1,
      label: t('XML Values'),
    });
    this.props.asset.content.translations.map((trns, n) => {
      let label = t('Labels');
      if (trns) {
        label += ` - ${trns}`;
      }
      options.push({
        value: n,
        label: label,
      });
    });
    return options;
  }

  render() {
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
                {this.listColumns().map(function (col) {
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
    );
  }
}

reactMixin(TableSettings.prototype, Reflux.ListenerMixin);
reactMixin(TableSettings.prototype, mixins.permissions);

export default TableSettings;
