import cx from 'classnames'
import React from 'react'
import Button from '#/components/common/button'
import TemplatesList from '#/components/templatesList'
import styles from '../ProjectSettings.module.scss'
import BackButton from '../components/BackButton'
import type { StepName } from '../constants'

interface StepChooseTemplateProps {
  chosenTemplateUid: string | null
  onTemplateChange: (templateUid: string) => void
  applyTemplateButton: string
  isApplyTemplatePending: boolean
  onApplyTemplate: (evt: React.MouseEvent<HTMLButtonElement>) => void
  previousStep: StepName | null
  onBack: () => void
  isBackDisabled: boolean
  modalStyle: string | null
}

export default function StepChooseTemplate({
  chosenTemplateUid,
  onTemplateChange,
  applyTemplateButton,
  isApplyTemplatePending,
  onApplyTemplate,
  previousStep,
  onBack,
  isBackDisabled,
  modalStyle,
}: StepChooseTemplateProps) {
  return (
    <form className={cx(styles.chooseTemplate, modalStyle)}>
      <TemplatesList onSelectTemplate={onTemplateChange} />

      <footer className={styles.modalFooter}>
        <BackButton previousStep={previousStep} isDisabled={isBackDisabled} onClick={onBack} />

        <Button
          type='primary'
          size='l'
          onClick={onApplyTemplate}
          isDisabled={!chosenTemplateUid || isApplyTemplatePending}
          label={applyTemplateButton}
        />
      </footer>
    </form>
  )
}
