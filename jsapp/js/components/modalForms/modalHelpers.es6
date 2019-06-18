import React from 'react';
import bem from 'js/bem';
import stores from 'js/stores';
import {t} from 'js/utils';

export function renderLoading(message = t('loading…')) {
  return (
    <bem.Loading>
      <bem.Loading__inner>
        <i />
        {message}
      </bem.Loading__inner>
    </bem.Loading>
  );
}

export function renderBackButton(isDisabled = false) {
  if (stores.pageState.hasPreviousModal()) {
    return (
      <bem.Modal__footerButton
        m='back'
        type='button'
        onClick={stores.pageState.switchToPreviousModal}
        disabled={isDisabled}
      >
        {t('Back')}
      </bem.Modal__footerButton>
    );
  } else {
    return null;
  }
}
