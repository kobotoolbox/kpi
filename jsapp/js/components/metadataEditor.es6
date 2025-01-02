import React from 'react';
import autoBind from 'react-autobind';
import Checkbox from 'js/components/common/checkbox';
import TextBox from 'js/components/common/textBox';
import Icon from 'js/components/common/icon';
import ToggleSwitch from 'js/components/common/toggleSwitch';
import Select from 'react-select';
import {
  QuestionTypeName,
  META_QUESTION_TYPES,
  SURVEY_DETAIL_ATTRIBUTES,
  FUNCTION_TYPE,
} from 'js/constants';
import bem, {makeBem} from 'js/bem';
import envStore from 'js/envStore';
import './metadataEditor.scss';

bem.FormBuilderMeta = makeBem(null, 'form-builder-meta');
bem.FormBuilderMeta__columns = makeBem(bem.FormBuilderMeta, 'columns');
bem.FormBuilderMeta__column = makeBem(bem.FormBuilderMeta, 'column');
bem.FormBuilderMeta__row = makeBem(bem.FormBuilderMeta, 'row');
bem.FormBuilderMeta__labelLink = makeBem(bem.FormBuilderMeta, 'label-link', 'a');

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
        newState.metaProperties.push(Object.assign({}, detail.attributes));
      }
    });

    const backgroundAudioDetail = this.getSurveyDetail(
      QuestionTypeName['background-audio']
    );
    if (backgroundAudioDetail) {
      newState.metaProperties.push(
        Object.assign({}, backgroundAudioDetail.attributes)
      );
    }

    this.setState(newState);
  }

  getMetaProperty(metaType) {
    return this.state.metaProperties.find(
      (metaProp) => metaProp.name === metaType
    );
  }

  getSurveyDetail(sdId) {
    return this.props.survey.surveyDetails.filter(
      (sd) => sd.attributes.name === sdId
    )[0];
  }

  onCheckboxChange(name, isChecked) {
    this.getSurveyDetail(name).set(
      SURVEY_DETAIL_ATTRIBUTES.value.id,
      isChecked
    );
    // Append parameters column with ODK_DEFAULT_AUDIO_QUALITY by default for
    // background-audio type
    if (isChecked && name === QuestionTypeName['background-audio']) {
      this.getSurveyDetail(name).set(
        SURVEY_DETAIL_ATTRIBUTES.parameters.id,
        ODK_DEFAULT_AUDIO_QUALITY.value
      );
    }

    this.rebuildState();
    if (typeof this.props.onChange === FUNCTION_TYPE.function.id) {
      this.props.onChange();
    }
  }

  onAuditParametersChange(newVal) {
    this.getSurveyDetail(META_QUESTION_TYPES.audit).set(
      SURVEY_DETAIL_ATTRIBUTES.parameters.id,
      newVal
    );
    this.rebuildState();
    if (typeof this.props.onChange === FUNCTION_TYPE.function.id) {
      this.props.onChange();
    }
  }

  isAuditEnabled() {
    const metaProp = this.getMetaProperty(META_QUESTION_TYPES.audit);
    return metaProp.value === true;
  }

  onBackgroundAudioParametersChange(newVal) {
    this.getSurveyDetail(QuestionTypeName['background-audio']).set(
      SURVEY_DETAIL_ATTRIBUTES.parameters.id,
      newVal.value
    );
    this.rebuildState();
    if (typeof this.props.onChange === FUNCTION_TYPE.function.id) {
      this.props.onChange();
    }
  }

  isBackgroundAudioEnabled() {
    const metaProp = this.getMetaProperty(QuestionTypeName['background-audio']);
    return metaProp.value === true;
  }

  getBackgroundAudioParameters() {
    const metaProp = this.getMetaProperty(QuestionTypeName['background-audio']);
    let foundParams = ODK_DEFAULT_AUDIO_QUALITY;
    if (metaProp.parameters) {
      foundParams = AUDIO_QUALITY_OPTIONS.find(
        (option) => option.value === metaProp.parameters
      );
    }
    return foundParams;
  }

  getAuditParameters() {
    const metaProp = this.getMetaProperty(META_QUESTION_TYPES.audit);
    return metaProp.parameters;
  }

  renderAuditInputLabel() {
    return (
      <React.Fragment>
        {t('Audit settings')}

        {envStore.isReady &&
          envStore.data.support_url && (
            <bem.FormBuilderMeta__labelLink
              href={envStore.data.support_url + AUDIT_SUPPORT_URL}
              target='_blank'
            >
              <Icon name='help' size='xs' color='blue' />
            </bem.FormBuilderMeta__labelLink>
          )}
      </React.Fragment>
    );
  }

  renderBackgroundAudioLabel() {
    return (
      <React.Fragment>
        {t('Background audio')}

        {envStore.isReady &&
          envStore.data.support_url && (
            <bem.FormBuilderMeta__labelLink
              href={envStore.data.support_url + RECORDING_SUPPORT_URL}
              target='_blank'
            >
              <Icon name='help' size='s' color='blue' />
            </bem.FormBuilderMeta__labelLink>
          )}
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
      META_QUESTION_TYPES.audit,
    ];
    const rightColumn = [
      META_QUESTION_TYPES.username,
      META_QUESTION_TYPES.phonenumber,
      META_QUESTION_TYPES.deviceid,
      META_QUESTION_TYPES['start-geopoint'],
    ];

    let backgroundAudioProp = this.getMetaProperty(
      QuestionTypeName['background-audio']
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

        {this.isAuditEnabled() && (
          <bem.FormBuilderMeta__row>
            <TextBox
              label={this.renderAuditInputLabel()}
              value={this.getAuditParameters()}
              disabled={this.props.isDisabled}
              onChange={this.onAuditParametersChange}
              placeholder={t('Enter audit settings here')}
            />
          </bem.FormBuilderMeta__row>
        )}

        <bem.FormBuilderMeta__row m='background-audio'>
          <bem.FormBuilderAside__header>
            {this.renderBackgroundAudioLabel()}
          </bem.FormBuilderAside__header>

          <bem.FormModal__item>
            <label className='long'>
              {t('This functionality is available in ')}
              <a title="Install KoBoCollect"
                target="_blank"
                href='https://play.google.com/store/apps/details?id=org.koboc.collect.android'>
                {t('Collect version 1.30 and above')}
              </a>
            </label>

            <ToggleSwitch
              checked={backgroundAudioProp.value}
              onChange={this.onCheckboxChange.bind(
                this,
                backgroundAudioProp.name
              )}
              label={
                backgroundAudioProp.value
                  ? t('This survey will be recorded')
                  : t('Enable audio recording in the background')
              }
              disabled={this.props.isDisabled}
            />
          </bem.FormModal__item>
        </bem.FormBuilderMeta__row>

        {this.isBackgroundAudioEnabled() && (
          <bem.FormBuilderMeta__row>
            <bem.FormModal__item>
              <label>{t('Audio quality')}</label>

              <Select
                className='kobo-select'
                classNamePrefix='kobo-select'
                value={this.getBackgroundAudioParameters()}
                defaultValue={ODK_DEFAULT_AUDIO_QUALITY}
                options={AUDIO_QUALITY_OPTIONS}
                onChange={this.onBackgroundAudioParametersChange}
                isDisabled={this.props.isDisabled}
              />
            </bem.FormModal__item>
          </bem.FormBuilderMeta__row>
        )}
      </bem.FormBuilderMeta>
    );
  }
}
