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

  renderRow(rowData, itemIndex) {
    return (
      <bem.SimpleTable__row key={itemIndex}>
        <bem.SimpleTable__cell>
          type
        </bem.SimpleTable__cell>

        <bem.SimpleTable__cell>
          date
        </bem.SimpleTable__cell>

        <bem.SimpleTable__cell>
          lang
        </bem.SimpleTable__cell>

        <bem.SimpleTable__cell>
          yes/no
        </bem.SimpleTable__cell>

        <bem.SimpleTable__cell>
          yes/no
        </bem.SimpleTable__cell>

        <bem.SimpleTable__cell>
          actions
        </bem.SimpleTable__cell>
      </bem.SimpleTable__row>
    );
  }

  render() {
    const todoRows = [1,2,3];

    return (
      <bem.FormView__row>
        <bem.FormView__cell m={['page-title']}>
          {t('Exports')}
        </bem.FormView__cell>

        <bem.SimpleTable m='project-exports'>
          <bem.SimpleTable__header>
            <bem.SimpleTable__row>
              <bem.SimpleTable__cell>
                {t('Type')}
              </bem.SimpleTable__cell>

              <bem.SimpleTable__cell>
                {t('Created')}
              </bem.SimpleTable__cell>

              <bem.SimpleTable__cell>
                {t('Language')}
              </bem.SimpleTable__cell>

              <bem.SimpleTable__cell>
                {t('Include Groups')}
              </bem.SimpleTable__cell>

              <bem.SimpleTable__cell>
                {t('Multiple Versions')}
              </bem.SimpleTable__cell>

              <bem.SimpleTable__cell/>
            </bem.SimpleTable__row>
          </bem.SimpleTable__header>

          <bem.SimpleTable__body>
            {todoRows.map(this.renderRow)}
          </bem.SimpleTable__body>
        </bem.SimpleTable>
      </bem.FormView__row>
    );
  }
}
