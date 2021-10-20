import React from 'react'
import bem, {makeBem} from 'js/bem'
import LanguageSelector from 'js/components/languages/languageSelector'
import './singleProcessingContent.scss'

bem.SingleProcessingContent = makeBem(null, 'single-processing-content', 'section')
bem.SingleProcessingContent__tabs = makeBem(bem.SingleProcessingContent, 'tabs', 'ul')
bem.SingleProcessingContent__tab = makeBem(bem.SingleProcessingContent, 'tab', 'li')
bem.SingleProcessingContent__body = makeBem(bem.SingleProcessingContent, 'body', 'section')

enum SingleProcessingTab {
  Transcript,
  Translations,
  Coding,
}

type SingleProcessingContentProps = {}

type SingleProcessingContentState = {
  activeTab: SingleProcessingTab
}

export default class SingleProcessingContent extends React.Component<
  SingleProcessingContentProps,
  SingleProcessingContentState
> {
  constructor(props: SingleProcessingContentProps) {
    super(props)
    this.state = {
      activeTab: SingleProcessingTab.Transcript
    }
  }

  switchTab(newTab: SingleProcessingTab) {
    this.setState({activeTab: newTab})
  }

  onLanguageChange(newVal: string | undefined) {
    console.log('language set', newVal)
  }

  renderTabContent() {
    switch (this.state.activeTab) {
      case SingleProcessingTab.Transcript:
        return <div>
          <LanguageSelector onLanguageChange={this.onLanguageChange.bind(this)}/>
        </div>
      case SingleProcessingTab.Translations:
        return 'TODO translations tab content'
      case SingleProcessingTab.Coding:
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
            m={{active: this.state.activeTab === SingleProcessingTab.Transcript}}
            onClick={this.switchTab.bind(this, SingleProcessingTab.Transcript)}
          >
            {t('Transcript')}
          </bem.SingleProcessingContent__tab>

          <bem.SingleProcessingContent__tab
            m={{active: this.state.activeTab === SingleProcessingTab.Translations}}
            onClick={this.switchTab.bind(this, SingleProcessingTab.Translations)}
          >
            {t('Translations')}
          </bem.SingleProcessingContent__tab>

          <bem.SingleProcessingContent__tab
            m={{active: this.state.activeTab === SingleProcessingTab.Coding}}
            onClick={this.switchTab.bind(this, SingleProcessingTab.Coding)}
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
