import React from 'react'
import Select from 'react-select'
import envStore from 'js/envStore'
import {formatTime} from 'js/utils'
import bem, {makeBem} from 'js/bem'
import singleProcessingStore, {SingleProcessingTabs} from 'js/components/processing/singleProcessingStore'
import './singleProcessingPreview.scss'

bem.SingleProcessingPreview = makeBem(null, 'single-processing-preview', 'section')

/** This component is handling the tabs for switching the content. */
export default class SingleProcessingPreview extends React.Component {
  private unlisteners: Function[] = []

  componentDidMount() {
    this.unlisteners.push(
      singleProcessingStore.listen(this.onSingleProcessingStoreChange, this)
    )
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {clb()})
  }

  onSingleProcessingStoreChange() {
    /**
     * Don't want to store a duplicate of `activeTab` here, so we need to make
     * the component re-render itself when the store changes :shrug:.
     */
    this.forceUpdate()
  }

  renderLanguageAndDate() {
    const source = singleProcessingStore.getSourceData()

    const contentLanguageCode = source?.languageCode
    if (contentLanguageCode === undefined) {
      return null
    }

    let dateText = ''
    if (source) {
      if (source.dateCreated !== source?.dateModified) {
        dateText = t('last modified ##date##').replace('##date##', formatTime(source.dateModified))
      } else {
        dateText = t('created ##date##').replace('##date##', formatTime(source.dateCreated))
      }
    }

    return (
      <React.Fragment>
        {this.renderLanguage()}

        {dateText !== '' &&
          <bem.ProcessingBody__transHeaderDate>
            {dateText}
          </bem.ProcessingBody__transHeaderDate>
        }
      </React.Fragment>
    )
  }

  /** Renders a text or a selector of translations. */
  renderLanguage() {
    const sources = singleProcessingStore.getSources()
    const sourceData = singleProcessingStore.getSourceData()

    if (sources.length === 0 || sourceData?.languageCode === undefined) {
      return null
    }

    // If there is only one source, we display it as a text.
    if (sources.length === 1) {
      return (
        <bem.ProcessingBody__transHeaderLanguageWrapper>
          {t('Language')}
          <bem.ProcessingBody__transHeaderLanguage>
            {envStore.getLanguageDisplayLabel(sourceData.languageCode)}
          </bem.ProcessingBody__transHeaderLanguage>
        </bem.ProcessingBody__transHeaderLanguageWrapper>
      )
    }

    if (sources.length >= 2) {
      const selectValue = {
        value: sourceData.languageCode,
        label: envStore.getLanguageDisplayLabel(sourceData.languageCode)
      }

      const selectOptions: {value: string, label: string}[] = []
      sources.forEach((source) => {
        selectOptions.push({
          value: source,
          label: envStore.getLanguageDisplayLabel(source)
        })
      })

      // TODO: don't use Select because of styles issues, use KoboDropdown
      return (
        <bem.ProcessingBody__transHeaderLanguageWrapper>
          {t('Language')}
          <bem.ProcessingBody__transHeaderLanguage>
            <Select
              className='kobo-select'
              classNamePrefix='kobo-select'
              isSearchable={false}
              isClearable={false}
              inputId='translations-languages'
              value={selectValue}
              options={selectOptions}
              onChange={(newVal) => {newVal?.value && singleProcessingStore.setSource(newVal.value)}}
            />
          </bem.ProcessingBody__transHeaderLanguage>
        </bem.ProcessingBody__transHeaderLanguageWrapper>
      )
    }

    return null
  }

  render() {
    const source = singleProcessingStore.getSourceData()

    if (
      source &&
      singleProcessingStore.getActiveTab() === SingleProcessingTabs.Translations
    ) {
      return (
        <bem.SingleProcessingPreview>
          <bem.ProcessingBody>
            <bem.ProcessingBody__transHeader>
              {this.renderLanguageAndDate()}
            </bem.ProcessingBody__transHeader>

            <bem.ProcessingBody__text>
              {singleProcessingStore.getSourceData()?.content}
            </bem.ProcessingBody__text>
          </bem.ProcessingBody>
        </bem.SingleProcessingPreview>
      )
    }

    return null
  }
}
