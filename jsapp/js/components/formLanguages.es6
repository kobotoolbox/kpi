import React from 'react';
import PropTypes from 'prop-types';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import actions from '../actions';
import bem from '../bem';
import stores from '../stores';
import ui from '../ui';
import mixins from '../mixins';

import {
  formatTime,
  t,
  notify
} from '../utils';

export class FormLanguages extends React.Component {
  constructor(props){
    super(props);
    autoBind(this);
  }

  render() {
    return (
      <bem.FormView__cell m={['columns', 'padding', 'bordertop', 'languages']}>
        <bem.FormView__cell m='languages-col1'>
          <strong>{t('Languages')}</strong>
          {this.props.summary.languages.map((l, i)=>{
            return (
              <bem.FormView__cell key={`lang-${i}`} m='langButton'>
                {l}
              </bem.FormView__cell>
            );
          })}
        </bem.FormView__cell>
        <bem.FormView__cell m='languages-col2'>
          <bem.FormView__link m='add-edit-languages'
            data-tip={t('Manage Translations')}>
            <i className='k-icon-globe' />
          </bem.FormView__link>
        </bem.FormView__cell>
      </bem.FormView__cell>
    );
  }

};

reactMixin(FormLanguages.prototype, mixins.permissions);
export default FormLanguages;
