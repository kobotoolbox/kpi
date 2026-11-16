import React from 'react'
import Button from '#/components/common/ButtonNew'
import type { StepName } from '../constants'

interface BackButtonProps {
  previousStep: StepName | null
  isDisabled: boolean
  onClick: () => void
}

export default function BackButton({ previousStep, isDisabled, onClick }: BackButtonProps) {
  if (!previousStep) {
    return null
  }

  return (
    <Button variant='light' size='lg' onClick={onClick} disabled={isDisabled}>
      {t('Back')}
    </Button>
  )
}
