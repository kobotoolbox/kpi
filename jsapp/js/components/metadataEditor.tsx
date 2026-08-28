import './metadataEditor.scss'

import React from 'react'

import { Switch } from '@mantine/core'
import autoBind from 'react-autobind'
import bem, { makeBem } from '#/bem'
import Select from '#/components/common/Select'
import TextInput from '#/components/common/TextInput'
import Checkbox from '#/components/common/checkbox'
import Icon from '#/components/common/icon'
import { META_QUESTION_TYPES, QuestionTypeName, SURVEY_DETAIL_ATTRIBUTES } from '#/constants'
import envStore from '#/envStore'
import { recordKeys } from '#/utils'
import type { Survey } from '../../xlform/src/model.survey'
import type { SurveyDetail } from '../../xlform/src/model.surveyDetail'

bem.FormBuilderMeta = makeBem(null, 'form-builder-meta')
bem.FormBuilderMeta__columns = makeBem(bem.FormBuilderMeta, 'columns')
bem.FormBuilderMeta__column = makeBem(bem.FormBuilderMeta, 'column')
bem.FormBuilderMeta__row = makeBem(bem.FormBuilderMeta, 'row')
bem.FormBuilderMeta__labelLink = makeBem(bem.FormBuilderMeta, 'label-link', 'a')

const AUDIT_SUPPORT_URL = 'form_meta.html#audit-metadata-question'
const SUPPORT_ENABLE_BG_AUDIO_URL = 'form_meta.html#enabling-background-audio-recording'

const AUDIO_QUALITY_OPTIONS = [
  { value: 'quality=low', label: t('Low') },
  { value: 'quality=normal', label: t('Normal') },
  { value: 'quality=voice-only', label: t('Voice only') },
]
const ODK_DEFAULT_AUDIO_QUALITY = AUDIO_QUALITY_OPTIONS[2]

/** A single row of the `surveyDetails` collection, detached from its model. */
type MetaProperty = SurveyDetail['attributes']

interface MetadataEditorProps {
  survey?: Survey
  /** Disables every control in the editor. */
  isDisabled?: boolean
  onChange?: () => void
}

interface MetadataEditorState {
  metaProperties: MetaProperty[]
}

export default class MetadataEditor extends React.Component<MetadataEditorProps, MetadataEditorState> {
  constructor(props: MetadataEditorProps) {
    super(props)
    this.state = {
      metaProperties: [],
    }
    autoBind(this)
  }

  componentDidMount() {
    this.rebuildState()
  }

  rebuildState() {
    const newState: MetadataEditorState = { metaProperties: [] }
    recordKeys(META_QUESTION_TYPES).forEach((metaType) => {
      const detail = this.getSurveyDetail(metaType)
      if (detail) {
        newState.metaProperties.push(Object.assign({}, detail.attributes))
      }
    })

    const backgroundAudioDetail = this.getSurveyDetail(QuestionTypeName['background-audio'])
    if (backgroundAudioDetail) {
      newState.metaProperties.push(Object.assign({}, backgroundAudioDetail.attributes))
    }

    this.setState(newState)
  }

  getMetaProperty(metaType: string) {
    return this.state.metaProperties.find((metaProp) => metaProp.name === metaType)
  }

  getSurveyDetail(sdId: string) {
    return this.props.survey?.surveyDetails.filter((sd) => sd.attributes.name === sdId)[0]
  }

  onCheckboxChange(name: string, isChecked: boolean) {
    this.getSurveyDetail(name)?.set(SURVEY_DETAIL_ATTRIBUTES.value.id, isChecked)
    // Append parameters column with ODK_DEFAULT_AUDIO_QUALITY by default for
    // background-audio type
    if (isChecked && name === QuestionTypeName['background-audio']) {
      this.getSurveyDetail(name)?.set(SURVEY_DETAIL_ATTRIBUTES.parameters.id, ODK_DEFAULT_AUDIO_QUALITY.value)
    }

    this.rebuildState()
    this.props.onChange?.()
  }

  onAuditParametersChange(newVal: string) {
    this.getSurveyDetail(META_QUESTION_TYPES.audit)?.set(SURVEY_DETAIL_ATTRIBUTES.parameters.id, newVal)
    this.rebuildState()
    this.props.onChange?.()
  }

  isAuditEnabled() {
    const metaProp = this.getMetaProperty(META_QUESTION_TYPES.audit)
    return metaProp?.value === true
  }

  onBackgroundAudioParametersChange(newValue: string | null) {
    // It's not really possible to have `null` here, as `Select` is not clearable.
    if (newValue === null) {
      return
    }

    this.getSurveyDetail(QuestionTypeName['background-audio'])?.set(SURVEY_DETAIL_ATTRIBUTES.parameters.id, newValue)
    this.rebuildState()
    this.props.onChange?.()
  }

  isBackgroundAudioEnabled() {
    const metaProp = this.getMetaProperty(QuestionTypeName['background-audio'])
    return metaProp?.value === true
  }

  getBackgroundAudioParameters() {
    const metaProp = this.getMetaProperty(QuestionTypeName['background-audio'])
    if (metaProp?.parameters) {
      return AUDIO_QUALITY_OPTIONS.find((option) => option.value === metaProp.parameters)?.value ?? null
    }
    return ODK_DEFAULT_AUDIO_QUALITY.value
  }

  getAuditParameters() {
    const metaProp = this.getMetaProperty(META_QUESTION_TYPES.audit)
    return metaProp?.parameters ?? ''
  }

  renderAuditInputLabel() {
    return (
      <React.Fragment>
        {t('Audit settings')}

        {envStore.isReady && envStore.data.support_url && (
          <bem.FormBuilderMeta__labelLink href={envStore.data.support_url + AUDIT_SUPPORT_URL} target='_blank'>
            <Icon name='help' size='xs' color='blue' />
          </bem.FormBuilderMeta__labelLink>
        )}
      </React.Fragment>
    )
  }

  renderBackgroundAudioLabel() {
    return (
      <React.Fragment>
        {t('Background audio')}

        {envStore.isReady && envStore.data.support_url && (
          <bem.FormBuilderMeta__labelLink
            href={envStore.data.support_url + SUPPORT_ENABLE_BG_AUDIO_URL}
            target='_blank'
          >
            <Icon name='help' size='s' color='blue' />
          </bem.FormBuilderMeta__labelLink>
        )}
      </React.Fragment>
    )
  }

  renderMetaCheckbox(metaType: string) {
    const metaProp = this.getMetaProperty(metaType)

    // Not every survey defines every meta property, so rendering nothing is fine.
    if (!metaProp) {
      return null
    }

    return (
      <Checkbox
        key={`meta-${metaProp.name}`}
        label={metaProp.label}
        checked={metaProp.value}
        disabled={this.props.isDisabled}
        onChange={this.onCheckboxChange.bind(this, metaProp.name)}
      />
    )
  }

  render() {
    if (this.state.metaProperties.length === 0) {
      return null
    }

    const leftColumn = [
      META_QUESTION_TYPES.start,
      META_QUESTION_TYPES.end,
      META_QUESTION_TYPES.today,
      META_QUESTION_TYPES.audit,
    ]
    const rightColumn = [
      META_QUESTION_TYPES.username,
      META_QUESTION_TYPES.phonenumber,
      META_QUESTION_TYPES.deviceid,
      META_QUESTION_TYPES['start-geopoint'],
    ]

    const backgroundAudioProp = this.getMetaProperty(QuestionTypeName['background-audio'])

    return (
      <bem.FormBuilderMeta>
        <bem.FormBuilderMeta__columns>
          <bem.FormBuilderMeta__column>
            {leftColumn.map((metaType) => this.renderMetaCheckbox(metaType))}
          </bem.FormBuilderMeta__column>

          <bem.FormBuilderMeta__column>
            {rightColumn.map((metaType) => this.renderMetaCheckbox(metaType))}
          </bem.FormBuilderMeta__column>
        </bem.FormBuilderMeta__columns>

        {this.isAuditEnabled() && (
          <bem.FormBuilderMeta__row>
            <TextInput
              label={this.renderAuditInputLabel()}
              value={this.getAuditParameters()}
              disabled={this.props.isDisabled}
              onChange={(evt) => this.onAuditParametersChange(evt.currentTarget.value)}
              placeholder={t('Enter audit settings here')}
            />
          </bem.FormBuilderMeta__row>
        )}

        {backgroundAudioProp && (
          <bem.FormBuilderMeta__row m='background-audio'>
            <bem.FormBuilderAside__header>{this.renderBackgroundAudioLabel()}</bem.FormBuilderAside__header>

            <bem.FormModal__item>
              <Switch
                checked={backgroundAudioProp.value}
                onChange={(event) => this.onCheckboxChange(backgroundAudioProp.name, event.currentTarget.checked)}
                label={
                  backgroundAudioProp.value
                    ? t('This survey will be recorded')
                    : t('Enable audio recording in the background')
                }
                disabled={this.props.isDisabled}
                className='form-builder-aside__switch'
              />
            </bem.FormModal__item>
          </bem.FormBuilderMeta__row>
        )}

        {this.isBackgroundAudioEnabled() && (
          <bem.FormBuilderMeta__row>
            <bem.FormModal__item>
              <Select
                label={t('Audio quality')}
                value={this.getBackgroundAudioParameters()}
                data={AUDIO_QUALITY_OPTIONS}
                onChange={this.onBackgroundAudioParametersChange}
                disabled={this.props.isDisabled}
                searchable={false}
                clearable={false}
              />
            </bem.FormModal__item>
          </bem.FormBuilderMeta__row>
        )}
      </bem.FormBuilderMeta>
    )
  }
}
