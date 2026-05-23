import React from 'react'

import Button from '#/components/common/button'
import pageState from '#/pageState.store'

interface ModalBackButtonProps {
  isDisabled?: boolean
}

export default function ModalBackButton({ isDisabled = false }: ModalBackButtonProps): React.ReactElement | null {
  if (pageState.hasPreviousModal()) {
    return (
      <Button
        type='secondary'
        size='l'
        onClick={pageState.switchToPreviousModal}
        isDisabled={isDisabled}
        label={t('Back')}
      />
    )
  }

  return null
}
