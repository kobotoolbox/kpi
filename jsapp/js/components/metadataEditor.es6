import React from 'react';
import autoBind from 'react-autobind';
import Checkbox from 'js/components/checkbox';
import TextBox from 'js/components/textBox';
import {
  assign,
  t
} from 'js/utils';
import {
  META_QUESTION_TYPES,
} from 'js/constants';
import bem from 'js/bem';

/**
 * @prop {object} survey
 * @prop {function} onChange
 */
export default class MetadataEditor extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      metaProperties: [],
      auditAppearance: null
    };
    autoBind(this);
  }

  componentDidMount() {
    this.rebuildState();
  }

  rebuildState() {
    const newState = {
      metaProperties: []
    };
    META_QUESTION_TYPES.forEach((metaType) => {
      const typeDetail = this.getSurveyDetail(metaType);
      if (typeDetail) {
        newState.metaProperties.push(assign({}, typeDetail.attributes));
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

  onAuditAppearanceChange(newVal) {
    console.debug(newVal);
  }

  render() {
    if (this.state.metaProperties.length === 0) {
      return null;
    }

    const leftColumn = [
      META_QUESTION_TYPES.get('start'),
      META_QUESTION_TYPES.get('end'),
      META_QUESTION_TYPES.get('today'),
      META_QUESTION_TYPES.get('deviceid'),
      META_QUESTION_TYPES.get('audit')
    ];
    const rightColumn = [
      META_QUESTION_TYPES.get('username'),
      META_QUESTION_TYPES.get('simserial'),
      META_QUESTION_TYPES.get('subscriberid'),
      META_QUESTION_TYPES.get('phonenumber')
    ];

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
                  onChange={this.onCheckboxChange.bind(this, metaProp.name)}
                />
              );
            })}
          </bem.FormBuilderMeta__column>
        </bem.FormBuilderMeta__columns>

        <bem.FormBuilderMeta__row>
          <TextBox
            label={t('Audit settings')}
            value={this.state.auditAppearance}
            onChange={this.onAuditAppearanceChange}
          />
        </bem.FormBuilderMeta__row>

      </bem.FormBuilderMeta>
    );
  }
}
