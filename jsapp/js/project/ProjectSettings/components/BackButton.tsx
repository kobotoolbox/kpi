import React from 'react'
import Button from '#/components/common/button'
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

  return <Button type='secondary' size='l' onClick={onClick} isDisabled={isDisabled} label={t('Back')} />
}
