import React from 'react';
import ui from 'js/ui';
import {bem} from 'js/bem';

export default class FormNotFound extends React.Component {
  render() {
    return (
      <ui.Panel>
        <bem.Loading>
          <bem.Loading__inner>
            {t('path not found / recognized')}
          </bem.Loading__inner>
        </bem.Loading>
      </ui.Panel>
    );
  }
}
