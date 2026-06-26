import React from 'react'
import { PROJECT_SETTINGS_CONTEXTS } from '#/constants'
import styles from '../ProjectSettings.module.scss'
import { STEPS, type StepName } from '../constants'
import type { ProjectSettingsContext } from '../types'

interface StepFormSourceProps {
  context: ProjectSettingsContext
  modalStyle: string | null
  onSelectStep: (step: StepName) => void
}

/**
 * First step in the project creation/replacement wizard.
 * Shows different options based on context:
 * - NEW: Build from scratch, Use template, Upload, Import URL
 * - REPLACE: Upload, Import URL, Use template (no "build from scratch" - need form content)
 */
export default function StepFormSource({ context, modalStyle, onSelectStep }: StepFormSourceProps) {
  return (
    <form className={modalStyle || undefined}>
      {context !== PROJECT_SETTINGS_CONTEXTS.REPLACE && (
        <div className={styles.modalSubheader}>
          {t(
            'Choose one of the options below to continue. You will be prompted to enter name and other details in further steps.',
          )}
        </div>
      )}

      <div className={styles.sourceButtons}>
        {/* "Build from scratch" only available when creating new project */}
        {context === PROJECT_SETTINGS_CONTEXTS.NEW && (
          <button onClick={() => onSelectStep(STEPS.PROJECT_DETAILS)}>
            <i className='k-icon k-icon-edit' />
            {t('Build from scratch')}
          </button>
        )}

        {/* Template button position changes based on context */}
        {context === PROJECT_SETTINGS_CONTEXTS.NEW && (
          <button onClick={() => onSelectStep(STEPS.CHOOSE_TEMPLATE)}>
            <i className='k-icon k-icon-template' />
            {t('Use a template')}
          </button>
        )}

        <button onClick={() => onSelectStep(STEPS.UPLOAD_FILE)}>
          <i className='k-icon k-icon-upload' />
          {t('Upload an XLSForm')}
        </button>

        <button onClick={() => onSelectStep(STEPS.IMPORT_URL)}>
          <i className='k-icon k-icon-link' />
          {t('Import an XLSForm via URL')}
        </button>

        {/* Template button shown at bottom for REPLACE context */}
        {context !== PROJECT_SETTINGS_CONTEXTS.NEW && (
          <button onClick={() => onSelectStep(STEPS.CHOOSE_TEMPLATE)}>
            <i className='k-icon k-icon-template' />
            {t('Use a template')}
          </button>
        )}
      </div>
    </form>
  )
}
