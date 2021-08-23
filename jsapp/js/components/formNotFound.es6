import React from 'react';
import bem from 'js/bem';

export default class FormNotFound extends React.Component {
  render() {
    return (
      <bem.uiPanel>
        <bem.uiPanel__body>
          <bem.Loading>
            <bem.Loading__inner>
              {t('path not found / recognized')}
            </bem.Loading__inner>
          </bem.Loading>
        </bem.uiPanel__body>
      </bem.uiPanel>
    );
  }
}
