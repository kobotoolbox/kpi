import React from 'react'
import Button from '#/components/common/button'
import TextBox from '#/components/common/textBox'
import envStore from '#/envStore'
import styles from '../ProjectSettings.module.scss'
import BackButton from '../components/BackButton'
import type { StepName } from '../constants'

const VIA_URL_SUPPORT_URL = 'xlsform_with_kobotoolbox.html#importing-an-xlsform-via-url'

interface StepImportUrlProps {
  importUrl: string
  onImportUrlChange: (value: string) => void
  importUrlButton: string
  importUrlButtonEnabled: boolean
  onImportFromURL: (evt: React.FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>) => void
  previousStep: StepName | null
  onBack: () => void
  isBackDisabled: boolean
  modalStyle: string | null
}

export default function StepImportUrl({
  importUrl,
  onImportUrlChange,
  importUrlButton,
  importUrlButtonEnabled,
  onImportFromURL,
  previousStep,
  onBack,
  isBackDisabled,
  modalStyle,
}: StepImportUrlProps) {
  return (
    <form className={modalStyle || undefined}>
      <div className={styles.uploadInstructions}>
        {t('Enter a valid XLSForm URL in the field below.')}
        <br />

        {envStore.isReady && envStore.data.support_url && (
          <a href={envStore.data.support_url + VIA_URL_SUPPORT_URL} target='_blank'>
            {t('Having issues? See this help article.')}
          </a>
        )}
      </div>

      <div className={styles.input}>
        <TextBox type='url' label={t('URL')} placeholder='https://' value={importUrl} onChange={onImportUrlChange} />
      </div>

      <footer className={styles.modalFooter}>
        <BackButton previousStep={previousStep} isDisabled={isBackDisabled} onClick={onBack} />

        <Button
          type='primary'
          size='l'
          isSubmit
          onClick={onImportFromURL}
          isDisabled={!importUrlButtonEnabled}
          label={importUrlButton}
        />
      </footer>
    </form>
  )
}
