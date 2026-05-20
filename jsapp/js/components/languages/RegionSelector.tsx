import './RegionSelector.scss'

import React from 'react'

import { ActionIcon, Group, TextInput } from '@mantine/core'
import bem, { makeBem } from '#/bem'
import Select from '#/components/common/Select'
import Icon from '#/components/common/icon'
import languagesStore from './languagesStore'
import type { DetailedLanguage, LanguageCode, TransxServiceCode } from './languagesStore'

bem.RegionSelector = makeBem(null, 'region-selector', 'section')
bem.RegionSelector__loading = makeBem(bem.RegionSelector, 'loading')

interface RegionSelectorProps {
  isDisabled?: boolean
  /** The root language code of a language that possibly has regions. */
  rootLanguage: LanguageCode
  /** We display regions only from selected provider of given type. */
  serviceCode: TransxServiceCode
  serviceType: 'transcription' | 'translation'
  /** Callback for a region is being selected. */
  onRegionChange: (selectedRegion: LanguageCode | null) => void
  /** Callback for clicking "x" next to the root language. */
  onCancel: () => void
}

interface RegionSelectorState {
  options: { label: string; value: string }[]
  selectedOption: LanguageCode | null
  language?: DetailedLanguage
}

/**
 * For provided language code, this component displays a region selector (if
 * regions are available for that language). UI also has a cancel button that
 * is just notifying the parent.
 */
export default class RegionSelector extends React.Component<RegionSelectorProps, RegionSelectorState> {
  constructor(props: RegionSelectorProps) {
    super(props)
    this.state = {
      options: [],
      selectedOption: null,
    }
  }

  componentDidMount() {
    this.fetchDetails()
  }

  componentDidUpdate(prevProps: RegionSelectorProps) {
    if (prevProps.rootLanguage !== this.props.rootLanguage) {
      this.fetchDetails()
    }
  }

  async fetchDetails() {
    // Memoization for error handling.
    const targetLanguage = this.props.rootLanguage
    this.setState({ language: undefined })
    if (targetLanguage) {
      try {
        const language = await languagesStore.getLanguage(targetLanguage)
        // Just a safe check if source didn't change as we waited for the response.
        if (this.props.rootLanguage === language.code) {
          const options = this.buildOptions(language)
          const initialOption = options.length > 0 ? options[0].value : null
          this.setState({
            language: language,
            options: options,
            selectedOption: initialOption,
          })
          if (initialOption) {
            this.props.onRegionChange(initialOption)
          }
        }
      } catch (error) {
        // Here we use memoized value, as at this point the props might've changed.
        console.error(`Language ${targetLanguage} not found 6`)
      }
    }
  }

  buildOptions(language: DetailedLanguage): { label: string; value: string }[] {
    const outcome = []

    let serviceRegions
    if (this.props.serviceType === 'transcription') {
      serviceRegions = language.transcription_services[this.props.serviceCode]
    } else if (this.props.serviceType === 'translation') {
      serviceRegions = language.translation_services[this.props.serviceCode]
    }

    if (serviceRegions) {
      for (const ourLanguageCode in serviceRegions) {
        const serviceLanguageCode = serviceRegions[ourLanguageCode]
        const label = language.regions.find((region) => region.code === ourLanguageCode)?.name

        if (serviceLanguageCode && label) {
          outcome.push({
            label: label,
            value: serviceLanguageCode,
          })
        }
      }
    }

    // We return the options sorted by their labels.
    return outcome.sort((a, b) => {
      const labelA = a.label.toLowerCase() // ignore upper and lowercase
      const labelB = b.label.toLowerCase() // ignore upper and lowercase
      if (labelA < labelB) {
        return -1
      }
      if (labelA > labelB) {
        return 1
      }
      return 0 // happens when labels are equal (should not happen in real life)
    })
  }

  onOptionChange(option: LanguageCode | null) {
    this.setState({ selectedOption: option })
    this.props.onRegionChange(option)
  }

  render() {
    if (this.state.language === undefined) {
      return <bem.RegionSelector__loading>…</bem.RegionSelector__loading>
    }

    return (
      <bem.RegionSelector>
        <Group gap='xs'>
          <TextInput
            readOnly
            size='sm'
            value={this.state.language.name}
            leftSection={<Icon name='language-alt' size='s' />}
            w={220}
            rightSection={
              <ActionIcon
                variant='transparent'
                size='sm'
                onClick={this.props.onCancel}
                disabled={this.props.isDisabled}
              >
                <Icon name='close' size='xs' />
              </ActionIcon>
            }
          />

          {this.state.options.length !== 0 && (
            <Select
              w={220}
              data={this.state.options}
              value={this.state.selectedOption}
              size='sm'
              onChange={(newValue) => this.onOptionChange(newValue)}
              disabled={this.props.isDisabled}
              placeholder={t('Select a region...')}
            />
          )}
        </Group>
      </bem.RegionSelector>
    )
  }
}
