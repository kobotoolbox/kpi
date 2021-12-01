import React from 'react'
import Fuse from 'fuse.js'
import bem, {makeBem} from 'js/bem'
import Icon from 'js/components/common/icon'
import Button from 'js/components/common/button'
import envStore, {EnvStoreDataItem} from 'js/envStore'
import {FUSE_OPTIONS} from 'js/constants'
import './languageSelector.scss'

bem.LanguageSelector = makeBem(null, 'language-selector', 'section')
bem.LanguageSelector__title = makeBem(bem.LanguageSelector, 'title', 'h1')
bem.LanguageSelector__source = makeBem(bem.LanguageSelector, 'source')
bem.LanguageSelector__sourceLanguage = makeBem(bem.LanguageSelector, 'source-language')
bem.LanguageSelector__sourceLabel = makeBem(bem.LanguageSelector, 'source-label', 'label')
bem.LanguageSelector__searchBoxRow = makeBem(bem.LanguageSelector, 'search-box-row')
bem.LanguageSelector__searchBoxWrapper = makeBem(bem.LanguageSelector, 'search-box-wrapper')
bem.LanguageSelector__searchBox = makeBem(bem.LanguageSelector, 'search-box')
bem.LanguageSelector__searchBoxLabel = makeBem(bem.LanguageSelector, 'search-box-label', 'label')
bem.LanguageSelector__searchBoxInput = makeBem(bem.LanguageSelector, 'search-box-input', 'input')
bem.LanguageSelector__clearSearchBox = makeBem(bem.LanguageSelector, 'clear-search-box', 'button')
bem.LanguageSelector__selectedLanguage = makeBem(bem.LanguageSelector, 'selected-language')
bem.LanguageSelector__selectedLanguageLabel = makeBem(bem.LanguageSelector, 'selected-language-label')
bem.LanguageSelector__clearSelectedLanguage = makeBem(bem.LanguageSelector, 'clear-selected-language', 'button')
bem.LanguageSelector__list = makeBem(bem.LanguageSelector, 'list', 'ol')
bem.LanguageSelector__notFoundMessage = makeBem(bem.LanguageSelector, 'not-found-message', 'li')
bem.LanguageSelector__helpBar = makeBem(bem.LanguageSelector, 'help-bar', 'footer')

const LANGUAGE_SELECTOR_SUPPORT_URL = 'TODO.html';

type LanguageSelectorProps = {
  /** Replaces the title on top. */
  titleOverride?: string
  /** Jumpstarts the selector with a pre-selected language. */
  preselectedLanguage?: string
  /**
   * Useful for translations (adds some UI). Also the source language is
   * not selectable from the list.
   */
  sourceLanguage?: string
  /** Triggered after language is selected or cleared. */
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
  private allLanguages = envStore.getLanguages()

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

  openSupportPage() {
    window.open(envStore.data.support_url + LANGUAGE_SELECTOR_SUPPORT_URL, '_blank');
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
    // Filter out the source language first.
    const languages = [...this.allLanguages].filter((language) => {
      return language.value !== this.props.sourceLanguage
    })

    if (this.state.filterPhrase !== '') {
      let fuse = new Fuse(languages, {...FUSE_OPTIONS, keys: ['value', 'label']})
      return fuse.search(this.state.filterPhrase)
    }
    return languages
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
        <Button
          type='bare'
          color='gray'
          size='m'
          label={(<span>{label}&nbsp;<small>({value})</small></span>)}
          onClick={this.selectLanguage.bind(this, value)}
        />
      </li>
    )
  }

  renderSelectedLanguage() {
    if (!this.state.selectedLanguage) {
      return null
    }

    return (
      <bem.LanguageSelector__selectedLanguage>
        <Icon name='language-alt' size='m'/>

        <bem.LanguageSelector__selectedLanguageLabel>
          {envStore.getLanguageDisplayLabel(this.state.selectedLanguage)}
        </bem.LanguageSelector__selectedLanguageLabel>

        <bem.LanguageSelector__clearSelectedLanguage
          onClick={this.clearSelectedLanguage.bind(this)}
        >
          <Icon name='close' size='s'/>
        </bem.LanguageSelector__clearSelectedLanguage>
      </bem.LanguageSelector__selectedLanguage>
    )
  }

  renderSourceLanguage() {
    if (!this.props.sourceLanguage) {
      return null
    }

    return (
      <bem.LanguageSelector__source>
        <bem.LanguageSelector__sourceLabel>
          {t('original')}
        </bem.LanguageSelector__sourceLabel>

        <bem.LanguageSelector__sourceLanguage>
          <Icon name='language-alt' size='m'/>
          <span>{envStore.getLanguageDisplayLabel(this.props.sourceLanguage)}</span>
        </bem.LanguageSelector__sourceLanguage>
      </bem.LanguageSelector__source>
    )
  }

  renderSearchBox() {
    return (
      <bem.LanguageSelector__searchBoxWrapper>
        {this.props.sourceLanguage &&
          <bem.LanguageSelector__searchBoxLabel>
            {t('translation')}
          </bem.LanguageSelector__searchBoxLabel>
        }
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
      </bem.LanguageSelector__searchBoxWrapper>
    )
  }

  renderSearchForm() {
    const filteredLanguages = this.getFilteredLanguagesList()

    return (
      <React.Fragment>
        <bem.LanguageSelector__searchBoxRow>
          {this.props.sourceLanguage &&
            this.renderSourceLanguage()
          }
          {this.props.sourceLanguage &&
            <Icon name='arrow-right' size='l'/>
          }
          {this.renderSearchBox()}
        </bem.LanguageSelector__searchBoxRow>

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
              <Button
                type='bare'
                color='gray'
                size='m'
                label={(<span>
                  {t('I want to use')}&nbsp;"<strong>{this.state.filterPhrase}</strong>"
                </span>)}
                onClick={this.selectLanguage.bind(this, this.state.filterPhrase)}
              />
            </li>
          }
        </bem.LanguageSelector__list>

        <bem.LanguageSelector__helpBar>
          <Button
            type='bare'
            color='blue'
            startIcon='information'
            size='s'
            onClick={this.openSupportPage.bind(this)}
            label={t('I cannot find my language')}
          />
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
