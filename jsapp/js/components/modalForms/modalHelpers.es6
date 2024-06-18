import React from 'react';
import bem from 'js/bem';
import pageState from 'js/pageState.store';

export function renderBackButton(isDisabled = false) {
  if (pageState.hasPreviousModal()) {
    return (
      <bem.KoboButton
        m='whitegray'
        type='button'
        onClick={pageState.switchToPreviousModal}
        disabled={isDisabled}
      >
        {t('Back')}
      </bem.KoboButton>
    );
  } else {
    return null;
  }
}
