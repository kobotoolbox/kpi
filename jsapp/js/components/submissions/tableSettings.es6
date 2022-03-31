import React from 'react';
import Reflux from 'reflux';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Checkbox from 'js/components/common/checkbox';
import Radio from 'js/components/common/radio';
import bem from 'js/bem';
import {actions} from 'js/actions';
import mixins from 'js/mixins';
import {notify} from 'utils';
import {DATA_TABLE_SETTINGS} from 'js/components/submissions/tableConstants';
import tableStore from 'js/components/submissions/tableStore';
import './tableSettings.scss';

/**
 * This is a modal form that handles changing some of the table settings.
 */
class TableSettings extends React.Component {
  constructor(props){
    super(props);
    this.state = {
      showGroupName: tableStore.getShowGroupName(),
      showHXLTags: tableStore.getShowHXLTags(),
      translationIndex: tableStore.getTranslationIndex(),
    };
    autoBind(this);
  }

  componentDidMount() {
    actions.table.updateSettings.failed.listen(this.onUpdateSettingsFailed);
    tableStore.listen(this.onTableStoreChange);
  }

  onTableStoreChange() {
    this.setState({
      showGroupName: tableStore.getShowGroupName(),
      showHXLTags: tableStore.getShowHXLTags(),
      translationIndex: tableStore.getTranslationIndex(),
    });
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

  onSave() {
    const newTableSettings = {};
    newTableSettings[DATA_TABLE_SETTINGS.SHOW_GROUP] = this.state.showGroupName;
    newTableSettings[DATA_TABLE_SETTINGS.TRANSLATION] = this.state.translationIndex;
    newTableSettings[DATA_TABLE_SETTINGS.SHOW_HXL] = this.state.showHXLTags;
    tableStore.saveTableSettings(newTableSettings);
  }

  onReset() {
    const newTableSettings = {};
    newTableSettings[DATA_TABLE_SETTINGS.SHOW_GROUP] = null;
    newTableSettings[DATA_TABLE_SETTINGS.TRANSLATION] = null;
    newTableSettings[DATA_TABLE_SETTINGS.SHOW_HXL] = null;
    tableStore.saveTableSettings(newTableSettings);
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

        <bem.Modal__footer>
          {this.userCan('change_asset', this.props.asset) &&
            <bem.KoboButton m='whitegray' onClick={this.onReset}>
              {t('Reset')}
            </bem.KoboButton>
          }

          <bem.KoboButton m='blue' onClick={this.onSave}>
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
