import React from 'react'

type TranslationsTabContentProps = {}

type TranslationsTabContentState = {}

export default class TranslationsTabContent extends React.Component<
  TranslationsTabContentProps,
  TranslationsTabContentState
> {
  constructor(props: TranslationsTabContentProps) {
    super(props)
    this.state = {}
  }

  render() {
    return (
      <div>
        translations content
      </div>
    )
  }
}
