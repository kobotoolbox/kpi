import React from 'react';
import autoBind from 'react-autobind';
import Select from 'react-select';
import Checkbox from 'js/components/checkbox';
import TextBox from 'js/components/textBox';
import ToggleSwitch from 'js/components/toggleSwitch';
import {bem} from 'js/bem';
import {
  QUESTION_TYPES,
  META_QUESTION_TYPES,
  ADDITIONAL_SUBMISSION_PROPS,
} from 'js/constants';
import assetUtils from 'js/assetUtils';

/**
 * @prop {object} asset
 */
export default class ProjectExportsList extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
    autoBind(this);
  }

  render() {
    return (
      <bem.FormView__row>
        <bem.FormView__cell m={['page-title']}>
          {t('Exports')}
        </bem.FormView__cell>

        <bem.FormView__cell m={['box', 'padding']}>
          table
        </bem.FormView__cell>
      </bem.FormView__row>
    );
  }
}
