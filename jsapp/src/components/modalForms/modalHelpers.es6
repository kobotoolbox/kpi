import React from 'react';
import {bem} from 'js/bem';
import {stores} from 'js/stores';
import {
  ANON_USERNAME,
  PERMISSIONS_CODENAMES
} from 'js/constants';

export function renderBackButton(isDisabled = false) {
  if (stores.pageState.hasPreviousModal()) {
    return (
      <bem.KoboButton
        m='whitegray'
        type='button'
        onClick={stores.pageState.switchToPreviousModal}
        disabled={isDisabled}
      >
        {t('Back')}
      </bem.KoboButton>
    );
  } else {
    return null;
  }
}
