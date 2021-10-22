import React from 'react'
import Fuse from 'fuse.js'
import bem, {makeBem} from 'js/bem'
import Icon from 'js/components/common/icon'
import envStore, {EnvStoreDataItem} from 'js/envStore'
import {FUSE_OPTIONS} from 'js/constants'
import './languageSelector.scss'

bem.LanguageSelector = makeBem(null, 'language-selector', 'section')
bem.LanguageSelector__title = makeBem(bem.LanguageSelector, 'title', 'h1')
bem.LanguageSelector__searchBox = makeBem(bem.LanguageSelector, 'search-box')
bem.LanguageSelector__searchBoxInput = makeBem(bem.LanguageSelector, 'search-box-input', 'input')
bem.LanguageSelector__clearSearchBox = makeBem(bem.LanguageSelector, 'clear-search-box', 'button')
bem.LanguageSelector__selectedLanguage = makeBem(bem.LanguageSelector, 'selected-language')
bem.LanguageSelector__selectedLanguageLabel = makeBem(bem.LanguageSelector, 'selected-language-label')
bem.LanguageSelector__clearSelectedLanguage = makeBem(bem.LanguageSelector, 'clear-selected-language', 'button')
bem.LanguageSelector__list = makeBem(bem.LanguageSelector, 'list', 'ol')
bem.LanguageSelector__listLanguage = makeBem(bem.LanguageSelector, 'list-language', 'button')
bem.LanguageSelector__notFoundMessage = makeBem(bem.LanguageSelector, 'not-found-message', 'li')
bem.LanguageSelector__helpBar = makeBem(bem.LanguageSelector, 'help-bar', 'footer')

const LANGUAGE_SELECTOR_SUPPORT_URL = 'TODO.html';

type LanguageSelectorProps = {
  /** replaces the title on top */
  titleOverride?: string
  /** jumpstarts the selector with a pre-selected language */
  preselectedLanguage?: string
  /** triggered after language is selected or cleared */
  onLanguageChange: (selectedLanguage: string | undefined) => void
}

type LanguageSelectorState = {
  filterPhrase: string
  selectedLanguage?: string
}

/**
 * A complex language selector component.
 */
class LanguageSelector extends React.Component<
  LanguageSelectorProps,
  LanguageSelectorState
> {
  private allLanguages = envStore.data.all_languages

  constructor(props: LanguageSelectorProps){
    super(props)
    this.state = {
      filterPhrase: '',
      selectedLanguage: props.preselectedLanguage
    }
  }

  notifyParentComponent() {
    this.props.onLanguageChange(this.state.selectedLanguage)
  }

  isCustomLanguageVisible() {
    return (
      !this.state.selectedLanguage &&
      // there is something typed in the search
      this.state.filterPhrase !== '' &&
      // the typed thing is not a known language code
      envStore.getLanguage(this.state.filterPhrase) === undefined &&
      // the typed thing is not a known language label
      envStore.getLanguageByName(this.state.filterPhrase) === undefined
    )
  }

  onFilterPhraseChange(evt: React.ChangeEvent<HTMLInputElement>) {
    this.setState({filterPhrase: evt.target.value})
  }

  clearFilterPhrase() {
    this.setState({filterPhrase: ''})
  }

  selectLanguage(code: string) {
    this.setState({
      selectedLanguage: code,
      filterPhrase: ''
    }, this.notifyParentComponent.bind(this))
  }

  clearSelectedLanguage() {
    this.setState({selectedLanguage: undefined}, this.notifyParentComponent.bind(this))
  }

  getFilteredLanguagesList() {
    if (this.state.filterPhrase !== '') {
      let fuse = new Fuse(this.allLanguages, {...FUSE_OPTIONS, keys: ['value', 'label']})
      return fuse.search(this.state.filterPhrase)
    }
    return this.allLanguages
  }

  renderLanguageItem(languageObj: EnvStoreDataItem | Fuse.FuseResult<EnvStoreDataItem>) {
    let value
    let label
    if ('value' in languageObj) {
      value = languageObj.value
      label = languageObj.label
    } else if ('item' in languageObj) {
      value = languageObj.item.value
      label = languageObj.item.label
    }

    if (!value) {
      return null
    }

    return (
      <li key={value}>
        <bem.LanguageSelector__listLanguage
          onClick={this.selectLanguage.bind(this, value)}
        >
          {label} <small>({value})</small>
        </bem.LanguageSelector__listLanguage>
      </li>
    )
  }

  renderSelectedLanguage() {
    if (!this.state.selectedLanguage) {
      return null
    }
    let displayLanguage = this.state.selectedLanguage
    const envStoreLanguage = envStore.getLanguage(this.state.selectedLanguage)
    if (envStoreLanguage) {
      displayLanguage = envStoreLanguage.label
    }

    return (
      <bem.LanguageSelector__selectedLanguage>
        <Icon name='check' size='m'/>

        <bem.LanguageSelector__selectedLanguageLabel>
          {displayLanguage}
        </bem.LanguageSelector__selectedLanguageLabel>

        <bem.LanguageSelector__clearSelectedLanguage
          onClick={this.clearSelectedLanguage.bind(this)}
        >
          <Icon name='close' size='s'/>
        </bem.LanguageSelector__clearSelectedLanguage>
      </bem.LanguageSelector__selectedLanguage>
    )
  }

  renderSearchBox() {
    return (
      <bem.LanguageSelector__searchBox>
        <Icon name='search' size='m'/>

        <bem.LanguageSelector__searchBoxInput
          type='text'
          value={this.state.filterPhrase}
          onChange={this.onFilterPhraseChange.bind(this)}
          placeholder={t('Search for a language')}
        />

        {this.state.filterPhrase !== '' &&
          <bem.LanguageSelector__clearSearchBox
            onClick={this.clearFilterPhrase.bind(this)}
          >
            <Icon name='close' size='s'/>
          </bem.LanguageSelector__clearSearchBox>
        }
      </bem.LanguageSelector__searchBox>
    )
  }

  renderSearchForm() {
    const filteredLanguages = this.getFilteredLanguagesList()

    return (
      <React.Fragment>
        {this.renderSearchBox()}

        <bem.LanguageSelector__list>
          {filteredLanguages.length === 0 &&
            <bem.LanguageSelector__notFoundMessage key='empty'>
              {t("Sorry, didn't find any language…")}
            </bem.LanguageSelector__notFoundMessage>
          }

          {filteredLanguages.length >= 1 &&
            filteredLanguages.map(this.renderLanguageItem.bind(this))
          }

          {this.isCustomLanguageVisible() &&
            <li key='custom'>
              <bem.LanguageSelector__listLanguage
                onClick={this.selectLanguage.bind(this, this.state.filterPhrase)}
              >
                {t('I want to use')}
                &nbsp;
                "<strong>{this.state.filterPhrase}</strong>"
              </bem.LanguageSelector__listLanguage>
            </li>
          }
        </bem.LanguageSelector__list>

        <bem.LanguageSelector__helpBar>
          <a
            href={envStore.data.support_url + LANGUAGE_SELECTOR_SUPPORT_URL}
            target='_blank'
          >
            <Icon name='information' size='s'/>
            {t('I cannot find my language')}
          </a>
        </bem.LanguageSelector__helpBar>
      </React.Fragment>
    )
  }

  render() {
    return (
      <bem.LanguageSelector>
        <bem.LanguageSelector__title>
          {this.props.titleOverride ? this.props.titleOverride : t('Please select the language')}
        </bem.LanguageSelector__title>

        {this.state.selectedLanguage && this.renderSelectedLanguage() }

        {!this.state.selectedLanguage && this.renderSearchForm() }
      </bem.LanguageSelector>
    )
  }
}

export default LanguageSelector
