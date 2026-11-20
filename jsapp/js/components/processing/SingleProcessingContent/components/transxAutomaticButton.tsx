import React from 'react'

import Button from '#/components/common/button'
import type { LanguageCode } from '#/components/languages/languagesStore'
import { hasTranscriptServicesAvailable, hasTranslationServicesAvailable } from '#/components/languages/languagesUtils'
import envStore from '#/envStore'

interface TransxAutomaticButtonProps {
  onClick: () => void
  selectedLanguage: LanguageCode | null
  /** The language a text response is translated from, which the service must support too. */
  sourceLanguage?: LanguageCode | null
  /** Which type of service the button should check availability for. */
  type: 'transcript' | 'translation'
  disabled?: boolean
}

interface TransxAutomaticButtonState {
  isLoading: boolean
  isAvailable: boolean
}

/**
 * Wrapper for "automatic" button being displayed in config step for transcript
 * and translations tabs. We need it separately for DRY async data fetching.
 */
export default class TransxAutomaticButton extends React.Component<
  TransxAutomaticButtonProps,
  TransxAutomaticButtonState
> {
  constructor(props: TransxAutomaticButtonProps) {
    super(props)
    this.state = {
      isLoading: false,
      isAvailable: false,
    }
  }

  componentDidMount() {
    this.checkAvailability()
  }

  componentDidUpdate(prevProps: TransxAutomaticButtonProps) {
    if (
      prevProps.selectedLanguage !== this.props.selectedLanguage ||
      prevProps.sourceLanguage !== this.props.sourceLanguage
    ) {
      this.checkAvailability()
    }
  }

  async checkAvailability() {
    const languageCode = this.props.selectedLanguage
    const sourceLanguage = this.props.sourceLanguage

    // If there is no language selected, we simply reset properties and stop.
    if (!languageCode) {
      this.setState({
        isLoading: false,
        isAvailable: false,
      })
      return
    }

    this.setState({
      isLoading: true,
      isAvailable: false,
    })

    let hasServicesAvailable = false
    try {
      if (this.props.type === 'transcript') {
        hasServicesAvailable = await hasTranscriptServicesAvailable(languageCode)
      }
      if (this.props.type === 'translation') {
        const languagesToCheck = sourceLanguage ? [languageCode, sourceLanguage] : [languageCode]
        const results = await Promise.all(languagesToCheck.map((code) => hasTranslationServicesAvailable(code)))
        hasServicesAvailable = results.every(Boolean)
      }
    } catch (error) {
      console.error(
        sourceLanguage
          ? `Language ${languageCode} or ${sourceLanguage} not found 3`
          : `Language ${languageCode} not found 3`,
      )
    } finally {
      // Safety check if props didn't change during the wait.
      if (languageCode === this.props.selectedLanguage && sourceLanguage === this.props.sourceLanguage) {
        this.setState({
          isLoading: false,
          isAvailable: hasServicesAvailable,
        })
      }
    }
  }

  render() {
    if (envStore.data.asr_mt_features_enabled) {
      return (
        <Button
          type='primary'
          size='m'
          label={t('automatic')}
          onClick={this.props.onClick}
          isDisabled={this.props.disabled || !this.state.isAvailable}
          isPending={this.state.isLoading}
        />
      )
    } else {
      // We hide button for users that don't have access to the feature.
      return null
    }
  }
}
