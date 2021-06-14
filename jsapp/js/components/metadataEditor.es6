import React from 'react';
import autoBind from 'react-autobind';
import Checkbox from 'js/components/common/checkbox';
import TextBox from 'js/components/common/textBox';
import ToggleSwitch from 'js/components/common/toggleSwitch';
import Select from 'react-select';
import {assign} from 'utils';
import {
  META_QUESTION_TYPES,
} from 'js/constants';
import {bem} from 'js/bem';
import {stores} from 'js/stores';

const AUDIT_SUPPORT_URL = 'audit_logging.html';
const RECORDING_SUPPORT_URL = 'recording-interviews.html';

const AUDIO_QUALITY_OPTIONS = [
  {value: 'quality=low', label: 'Low'},
  {value: 'quality=normal', label: 'Normal'},
  {value: 'quality=voice-only', label: 'Voice only'},
];
const ODK_DEFAULT_AUDIO_QUALITY = AUDIO_QUALITY_OPTIONS[2];

/**
 * @prop {object} survey
 * @prop {boolean} isDisabled whether everything is disabled
 * @prop {function} onChange
 */
export default class MetadataEditor extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      metaProperties: [],
    };
    autoBind(this);
  }

  componentDidMount() {
    this.rebuildState();
  }

  rebuildState() {
    const newState = {metaProperties: []};
    Object.keys(META_QUESTION_TYPES).forEach((metaType) => {
      const detail = this.getSurveyDetail(metaType);
      if (detail) {
        newState.metaProperties.push(assign({}, detail.attributes));
      }
    });
    this.setState(newState);
  }

  getMetaProperty(metaType) {
    return this.state.metaProperties.find((metaProp) => {
      return metaProp.name === metaType;
    });
  }

  getSurveyDetail(sdId) {
    return this.props.survey.surveyDetails.filter((sd) => {
      return sd.attributes.name === sdId;
    })[0];
  }

  onCheckboxChange(name, isChecked) {
    this.getSurveyDetail(name).set('value', isChecked);
    this.rebuildState();
    if (typeof this.props.onChange === 'function') {
      this.props.onChange();
    }
  }

  onAuditParametersChange(newVal) {
    this.getSurveyDetail(META_QUESTION_TYPES.audit).set('parameters', newVal);
    this.rebuildState();
    if (typeof this.props.onChange === 'function') {
      this.props.onChange();
    }
  }

  isAuditEnabled() {
    const metaProp = this.getMetaProperty(META_QUESTION_TYPES.audit);
    return metaProp.value === true;
  }

  onBackgroundAudioParametersChange(newVal) {
    this.getSurveyDetail(META_QUESTION_TYPES['background-audio']).set(
      'parameters',
      newVal.value
    );
    this.rebuildState();
    if (typeof this.props.onChange === 'function') {
      this.props.onChange();
    }
  }

  isBackgroundAudioEnabled() {
    const metaProp = this.getMetaProperty(
      META_QUESTION_TYPES['background-audio']
    );
    return metaProp.value === true;
  }

  getAuditParameters() {
    const metaProp = this.getMetaProperty(META_QUESTION_TYPES.audit);
    return metaProp.parameters;
  }

  renderAuditInputLabel() {
    return (
      <React.Fragment>
        {t('Audit settings')}

        { stores.serverEnvironment &&
          stores.serverEnvironment.state.support_url &&
          <bem.TextBox__labelLink
            href={stores.serverEnvironment.state.support_url + AUDIT_SUPPORT_URL}
            target='_blank'
          >
            <i className='k-icon k-icon-help'/>
          </bem.TextBox__labelLink>
        }
      </React.Fragment>
    );
  }

  renderBackgroundAudioLabel() {
    return (
      <React.Fragment>
        {t('Background audio')}

        { stores.serverEnvironment &&
          stores.serverEnvironment.state.support_url &&
          <bem.TextBox__labelLink
            // TODO update support article to include background-audio
            href={stores.serverEnvironment.state.support_url + RECORDING_SUPPORT_URL}
            target='_blank'
          >
            <i className='k-icon k-icon-help'/>
          </bem.TextBox__labelLink>
        }
      </React.Fragment>
    );
  }

  render() {
    if (this.state.metaProperties.length === 0) {
      return null;
    }

    const leftColumn = [
      META_QUESTION_TYPES.start,
      META_QUESTION_TYPES.end,
      META_QUESTION_TYPES.today,
      META_QUESTION_TYPES.deviceid,
      META_QUESTION_TYPES.audit,
    ];
    const rightColumn = [
      META_QUESTION_TYPES.username,
      META_QUESTION_TYPES.simserial,
      META_QUESTION_TYPES.subscriberid,
      META_QUESTION_TYPES.phonenumber,
    ];

    let backgroundAudioProp = this.getMetaProperty(
      META_QUESTION_TYPES['background-audio']
    );

    return (
      <bem.FormBuilderMeta>
        <bem.FormBuilderMeta__columns>
          <bem.FormBuilderMeta__column>
            {leftColumn.map((metaType) => {
              const metaProp = this.getMetaProperty(metaType);
              return (
                <Checkbox
                  key={`meta-${metaProp.name}`}
                  label={metaProp.label}
                  checked={metaProp.value}
                  disabled={this.props.isDisabled}
                  onChange={this.onCheckboxChange.bind(this, metaProp.name)}
                />
              );
            })}
          </bem.FormBuilderMeta__column>

          <bem.FormBuilderMeta__column>
            {rightColumn.map((metaType) => {
              const metaProp = this.getMetaProperty(metaType);
              return (
                <Checkbox
                  key={`meta-${metaProp.name}`}
                  label={metaProp.label}
                  checked={metaProp.value}
                  disabled={this.props.isDisabled}
                  onChange={this.onCheckboxChange.bind(this, metaProp.name)}
                />
              );
            })}
          </bem.FormBuilderMeta__column>
        </bem.FormBuilderMeta__columns>

        <bem.FormBuilderMeta__row m='background-audio'>
          <bem.FormBuilderAside__header>
            {this.renderBackgroundAudioLabel()}
          </bem.FormBuilderAside__header>

          <bem.FormModal__item>
            <label className='long'>
              {t('This functionality is only available for Collect')}
            </label>

            <ToggleSwitch
              checked={backgroundAudioProp.value}
              onChange={this.onCheckboxChange.bind(this, backgroundAudioProp.name)}
              label={
                backgroundAudioProp.value
                  ? t('This survey will be recorded')
                  : t('Enable audio recording in the background')
              }
            />
          </bem.FormModal__item>

        </bem.FormBuilderMeta__row>

        {this.isAuditEnabled() &&
          <bem.FormBuilderMeta__row>
            <TextBox
              label={this.renderAuditInputLabel()}
              value={this.getAuditParameters()}
              disabled={this.props.isDisabled}
              onChange={this.onAuditParametersChange}
            />
          </bem.FormBuilderMeta__row>
        }

        {this.isBackgroundAudioEnabled() &&
          <bem.FormBuilderMeta__row>
            <bem.FormModal__item>
              <label>
                {t('Audio quality')}
              </label>

              <Select
                className='kobo-select'
                classNamePrefix='kobo-select'
                /*
                  defaultValue only displays the default value, it does not
                  append it to the JSON. If there is no quality parameter then
                  it would default to ODK_DEFAULT_AUDIO_QUALITY behind the scenes
                */
                defaultValue={ODK_DEFAULT_AUDIO_QUALITY}
                options={AUDIO_QUALITY_OPTIONS}
                onChange={this.onBackgroundAudioParametersChange}
              />
            </bem.FormModal__item>
          </bem.FormBuilderMeta__row>
        }

      </bem.FormBuilderMeta>
    );
  }
}
