import React from 'react'
import bem, {makeBem} from 'js/bem'
import singleProcessingStore, {SingleProcessingTabs} from 'js/components/processing/singleProcessingStore'
import TranscriptTabContent from 'js/components/processing/transcriptTabContent'
import TranslationsTabContent from 'js/components/processing/translationsTabContent'
import './singleProcessingContent.scss'

bem.SingleProcessingContent = makeBem(null, 'single-processing-content', 'section')
bem.SingleProcessingContent__tabs = makeBem(bem.SingleProcessingContent, 'tabs', 'ul')
bem.SingleProcessingContent__tab = makeBem(bem.SingleProcessingContent, 'tab', 'li')
bem.SingleProcessingContent__body = makeBem(bem.SingleProcessingContent, 'body', 'section')

/** This component is handling the tabs for switching the content. */
export default class SingleProcessingContent extends React.Component<any> {
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

  renderTabContent() {
    switch (singleProcessingStore.getActiveTab()) {
      case SingleProcessingTabs.Transcript:
        return <TranscriptTabContent/>
      case SingleProcessingTabs.Translations:
        return <TranslationsTabContent/>
      case SingleProcessingTabs.Coding:
        return 'TODO coding tab content'
      default:
        return null
    }
  }

  render() {
    return (
      <bem.SingleProcessingContent>
        <bem.SingleProcessingContent__tabs>
          <bem.SingleProcessingContent__tab
            m={{active: singleProcessingStore.getActiveTab() === SingleProcessingTabs.Transcript}}
            onClick={() => {singleProcessingStore.activateTab(SingleProcessingTabs.Transcript)}}
          >
            {t('Transcript')}
          </bem.SingleProcessingContent__tab>

          <bem.SingleProcessingContent__tab
            m={{active: singleProcessingStore.getActiveTab() === SingleProcessingTabs.Translations}}
            onClick={() => {singleProcessingStore.activateTab(SingleProcessingTabs.Translations)}}
            disabled={singleProcessingStore.getTranscript() === undefined}
          >
            {t('Translations')}
          </bem.SingleProcessingContent__tab>

          <bem.SingleProcessingContent__tab
            m={{active: singleProcessingStore.getActiveTab() === SingleProcessingTabs.Coding}}
            onClick={() => {singleProcessingStore.activateTab(SingleProcessingTabs.Coding)}}
            // TODO this is disabled until we build the feature.
            disabled
          >
            {t('Coding')}
          </bem.SingleProcessingContent__tab>
        </bem.SingleProcessingContent__tabs>

        <bem.SingleProcessingContent__body>
          {this.renderTabContent()}
        </bem.SingleProcessingContent__body>
      </bem.SingleProcessingContent>
    )
  }
}
