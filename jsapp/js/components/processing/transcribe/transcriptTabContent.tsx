import React from 'react'
import LanguageSelector from 'js/components/languages/languageSelector'

type TranscriptTabContentProps = {}

type TranscriptTabContentState = {}

export default class TranscriptTabContent extends React.Component<
  TranscriptTabContentProps,
  TranscriptTabContentState
> {
  constructor(props: TranscriptTabContentProps) {
    super(props)
    this.state = {}
  }

  onLanguageChange(newVal: string | undefined) {
    console.log('language set', newVal)
  }

  render() {
    return (
      <div style={{padding: '40px'}}>
        <LanguageSelector onLanguageChange={this.onLanguageChange.bind(this)}/>
      </div>
    )
  }
}
