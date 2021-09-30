import React from 'react'
import bem from 'js/bem'
import TextBox from 'js/components/common/textBox'
import './languageSelector.scss'

type LanguageSelectorProps = {
  preselectedValue?: string
  onLanguageChange: Function
}

type LanguageSelectorState = {
  textBoxValue: string
}

/**
 * A complex language selector component.
 */
class LanguageSelector extends React.Component<
  LanguageSelectorProps,
  LanguageSelectorState
> {
  constructor(props: LanguageSelectorProps){
    super(props)
    this.state = {
      textBoxValue: this.props.preselectedValue || ''
    }
  }

  onChange() {
    this.props.onLanguageChange('abc')
  }

  onTextBoxChange(newVal: string) {
    this.setState({textBoxValue: newVal})
  }

  render() {
    return (
      <bem.LanguageSelector>
        lang selector hi!
        <TextBox
          value={this.state.textBoxValue}
          onChange={this.onTextBoxChange.bind(this)}
        />
      </bem.LanguageSelector>
    )
  }
}

export default LanguageSelector
