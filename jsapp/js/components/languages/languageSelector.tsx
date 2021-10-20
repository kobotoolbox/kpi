import React from 'react'
import bem, {makeBem} from 'js/bem'
import TextBox from 'js/components/common/textBox'
import './languageSelector.scss'

bem.LanguageSelector = makeBem(null, 'language-selector', 'section')
bem.LanguageSelector__title = makeBem(bem.LanguageSelector, 'title', 'h1')
bem.LanguageSelector__searchBox = makeBem(bem.LanguageSelector, 'search-box')
bem.LanguageSelector__list = makeBem(bem.LanguageSelector, 'list', 'ol')
bem.LanguageSelector__language = makeBem(bem.LanguageSelector, 'language', 'button')

type LanguageSelectorProps = {
  /** replaces the title on top */
  titleOverride?: string
  /** jumpstarts the selector with a pre-selected language */
  preselectedValue?: string
  /** triggered after the final language selection */
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
