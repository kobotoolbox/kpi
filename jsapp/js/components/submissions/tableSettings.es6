import React from 'react';
import Reflux from 'reflux';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import clonedeep from 'lodash.clonedeep';
import Checkbox from 'js/components/common/checkbox';
import Radio from 'js/components/common/radio';
import {bem} from 'js/bem';
import {actions} from 'js/actions';
import mixins from 'js/mixins';
import {notify} from 'utils';
import {
  DATA_TABLE_SETTING,
  DATA_TABLE_SETTINGS,
} from 'js/components/submissions/tableConstants';
import './tableSettings.scss';

/**
 * This is a modal form that handles changing some of the table settings.
 *
 * @prop {object} asset
 * @prop {function} overrideLabelsAndGroups - used to temporary save settings (e.g. when user doesn't have permissions to edit asset, but wants to display submissions in different way)
 */
class TableSettings extends React.Component {
  constructor(props){
    super(props);
    this.state = {
      showGroupName: true,
      showHXLTags: false,
      translationIndex: 0,
    };

    let _sett = props.asset.settings;
    if (_sett[DATA_TABLE_SETTING]) {
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
      // Just delete the settings from this modal, i.e. leave frozen column
      // and selected columns intact.
      delete newSettings[DATA_TABLE_SETTING][DATA_TABLE_SETTINGS.SHOW_GROUP];
      delete newSettings[DATA_TABLE_SETTING][DATA_TABLE_SETTINGS.TRANSLATION];
      delete newSettings[DATA_TABLE_SETTING][DATA_TABLE_SETTINGS.SHOW_HXL];
    }

    actions.table.updateSettings(this.props.asset.uid, newSettings);
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
