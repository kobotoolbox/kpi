import React from 'react'

import Button from '#/components/common/button'
import pageState from '#/pageState.store'

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
    )
  } else {
    return null
  }
}
