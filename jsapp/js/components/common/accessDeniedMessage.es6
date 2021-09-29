import React from 'react';
import bem from 'js/bem';

export default class AccessDeniedMessage extends React.Component {
  render() {
    return (
      <bem.FormView>
        <bem.Loading>
          <bem.Loading__inner>
            <h3>
              {t('Access Denied')}
            </h3>
            {t('You do not have permission to view this page.')}
          </bem.Loading__inner>
        </bem.Loading>
      </bem.FormView>
    );
  }
}
