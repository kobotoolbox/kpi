import React from 'react'
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
    const source = singleProcessingStore.getTranslationSource()

    const contentLanguageCode = source?.languageCode
    if (contentLanguageCode === undefined) {
      return null
    }

    let dateText = ''
    if (source) {
      if (source.dateCreated !== source?.dateModified) {
        dateText = t('Modified ##date##').replace('##date##', formatTime(source.dateModified))
      } else {
        dateText = t('Created ##date##').replace('##date##', formatTime(source.dateCreated))
      }
    }

    return (
      <React.Fragment>
        <div>
          {t('Language')}
          <bem.ProcessingBody__transHeaderLanguage>
            {envStore.getLanguageDisplayLabel(contentLanguageCode)}
          </bem.ProcessingBody__transHeaderLanguage>
        </div>

        {dateText !== '' &&
          <bem.ProcessingBody__transHeaderDate>
            {dateText}
          </bem.ProcessingBody__transHeaderDate>
        }
      </React.Fragment>
    )
  }

  render() {
    const source = singleProcessingStore.getTranslationSource()

    if (
      !source ||
      singleProcessingStore.getActiveTab() !== SingleProcessingTabs.Translations
    ) {
      return null
    }

    return (
      <bem.SingleProcessingPreview>
        <bem.ProcessingBody>
          <bem.ProcessingBody__transHeader>
            {this.renderLanguageAndDate()}
          </bem.ProcessingBody__transHeader>

          <bem.ProcessingBody__text>
            {singleProcessingStore.getTranslationSource()?.content}
          </bem.ProcessingBody__text>
        </bem.ProcessingBody>
      </bem.SingleProcessingPreview>
    )
  }
}
