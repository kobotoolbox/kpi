import { useState, useEffect } from 'react'

import cx from 'classnames'
import securityStyles from '#/account/security/securityRoute.module.scss'
import ButtonNew from '#/components/common/ButtonNew'
import TextBox from '#/components/common/textBox'
import { dataInterface } from '#/dataInterface'
import { notify } from '#/utils'
import RegenerateApiKeyModal from './RegenerateApiKeyModal'
import styles from './apiTokenSection.module.scss'

const HIDDEN_TOKEN_VALUE = '*'.repeat(40)

/**
 * Displays secret API token of a logged in user.
 * The token is obfuscated until a "show me" button is clicked.
 * Users can regenerate their token (invalidating the old one) or copy it.
 */
export default function ApiTokenDisplay() {
  const [token, setToken] = useState<string | null>(null)
  const [isFetching, setIsFetching] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [isRegenerateModalOpen, setIsRegenerateModalOpen] = useState(false)

  const toggleTokenVisibility = () => {
    setIsVisible(!isVisible)
  }

  useEffect(() => {
    if (isVisible && token === null) {
      const fetchToken = async () => {
        setIsFetching(true)
        try {
          const result = await dataInterface.apiToken()
          setToken(result.token)
        } catch {
          notify.error(t('Failed to get API token'))
        } finally {
          setIsFetching(false)
        }
      }

      fetchToken()
    }
  }, [isVisible])

  const handleCopyToken = () => {
    if (!token) return
    // Use execCommand as a fallback for environments without navigator.clipboard
    const el = document.createElement('textarea')
    el.value = token
    el.style.cssText = 'position:fixed;opacity:0'
    document.body.appendChild(el)
    el.select()
    document.execCommand('copy')
    document.body.removeChild(el)
    notify.success(t('API key copied to clipboard'))
  }

  const handleRegenerateSuccess = (newToken: string) => {
    setToken(newToken)
    setIsVisible(true)
  }

  const isTokenRevealed = isVisible && !isFetching && token !== null

  return (
    <section className={securityStyles.securitySection}>
      <div className={securityStyles.securitySectionTitle}>
        <h2 className={securityStyles.securitySectionTitleText}>{t('API Key')}</h2>
      </div>

      <div className={cx(securityStyles.securitySectionBody, styles.body)}>
        <TextBox
          type={isTokenRevealed ? 'text' : 'password'}
          value={token !== null ? token : HIDDEN_TOKEN_VALUE}
          readOnly
          className={styles.token}
        />
      </div>

      <div className={styles.options}>
        <ButtonNew size='md' variant='light' onClick={toggleTokenVisibility}>
          {isVisible ? t('Hide') : t('Show')}
        </ButtonNew>

        {isTokenRevealed && (
          <ButtonNew size='md' variant='light' onClick={handleCopyToken}>
            {t('Copy')}
          </ButtonNew>
        )}

        <ButtonNew size='md' variant='filled' onClick={() => setIsRegenerateModalOpen(true)}>
          {t('Regenerate API Key')}
        </ButtonNew>
      </div>

      <RegenerateApiKeyModal
        opened={isRegenerateModalOpen}
        onClose={() => setIsRegenerateModalOpen(false)}
        onSuccess={handleRegenerateSuccess}
      />
    </section>
  )
}
