import React from 'react';
import pageState from 'js/pageState.store';
import Button from 'js/components/common/button';

export function renderBackButton(isDisabled = false) {
  if (pageState.hasPreviousModal()) {
    return (
      <Button
        type='secondary'
        size='l'
        onClick={pageState.switchToPreviousModal.bind(pageState)}
        isDisabled={isDisabled}
        label={t('Back')}
      />
    );
  } else {
    return null;
  }
}
