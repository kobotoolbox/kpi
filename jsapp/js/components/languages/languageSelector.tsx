import React from 'react'
import Fuse from 'fuse.js'
import bem, {makeBem} from 'js/bem'
import Icon from 'js/components/common/icon'
import Button from 'js/components/common/button'
import envStore, {EnvStoreDataItem} from 'js/envStore'
import {FUSE_OPTIONS} from 'js/constants'
import languageSelectorActions from './languageSelectorActions';
import './languageSelector.scss'

bem.LanguageSelector = makeBem(null, 'language-selector', 'section')
bem.LanguageSelector__title = makeBem(bem.LanguageSelector, 'title', 'h1')
bem.LanguageSelector__line = makeBem(bem.LanguageSelector, 'line', 'hr')
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
  /**
   * A list of languages that should be displayed in front of other languages.
   * Most possibly these languages were already chosen for other parts of given
   * feature or can be found in existing data.
   */
  suggestedLanguages?: string[]
  /** A list of languages that should be omitted from display. */
  hiddenLanguages?: string[]
  /** Triggered after language is selected or cleared. */
  onLanguageChange: (selectedLanguage: string | undefined) => void
}

type LanguageSelectorState = {
  filterPhrase: string
  selectedLanguage?: string
  allLanguages: EnvStoreDataItem[]
}

/**
 * A complex language selector component.
 */
class LanguageSelector extends React.Component<
  LanguageSelectorProps,
  LanguageSelectorState
> {
  private unlisteners: Function[] = []

  constructor(props: LanguageSelectorProps){
    super(props)
    this.state = {
      filterPhrase: '',
      selectedLanguage: props.preselectedLanguage,
      allLanguages: envStore.getLanguages()
    }
  }

  componentDidMount() {
    this.unlisteners.push(
      envStore.listen(this.onEnvStoreChange.bind(this), this),
      languageSelectorActions.resetAll.requested.listen(this.clearSelectedLanguage.bind(this))
    )
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {clb()})
  }

  /**
   * Ensures we have languages if this component renders faster than envStore
   * gets its languages.
   */
  onEnvStoreChange() {
    this.setState({allLanguages: envStore.getLanguages()})
  }

  notifyParentComponent() {
    this.props.onLanguageChange(this.state.selectedLanguage)
  }

  openSupportPage() {
    window.open(envStore.data.support_url + LANGUAGE_SELECTOR_SUPPORT_URL, '_blank')
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



  /** Return two lists of languages. */
  getFilteredLanguages(): {
    suggested: Fuse.FuseResult<EnvStoreDataItem>[] | EnvStoreDataItem[]
    other: Fuse.FuseResult<EnvStoreDataItem>[] | EnvStoreDataItem[]
  } {
    let hiddenLanguages = this.props.hiddenLanguages || []
    let suggestedLanguages = this.props.suggestedLanguages || []

    // Filter out the source language and hidden languages first. They should
    // not be displayed to user.
    const visible = [...this.state.allLanguages].filter((language) => {
      return (
        language.value !== this.props.sourceLanguage &&
        !hiddenLanguages.includes(language.value)
      )
    })

    // Split languages into suggested and the rest.
    const suggested = [...visible].filter((language) => suggestedLanguages.includes(language.value))
    const fuseSuggested = new Fuse(suggested, {...FUSE_OPTIONS, keys: ['value', 'label']})

    const other = [...visible].filter((language) => !suggestedLanguages.includes(language.value))
    const fuseOther = new Fuse(other, {...FUSE_OPTIONS, keys: ['value', 'label']})

    if (this.state.filterPhrase !== '') {
      return {
        suggested: fuseSuggested.search(this.state.filterPhrase),
        other: fuseOther.search(this.state.filterPhrase)
      }
    }
    return {
      suggested,
      other
    }
  }

  renderLanguageItem(
    languageObj: EnvStoreDataItem | Fuse.FuseResult<EnvStoreDataItem>
  ) {
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
          color='storm'
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

  renderSuggestedLanguages() {
    const filteredLanguages = this.getFilteredLanguages()

    if (filteredLanguages.suggested.length === 0) {
      return null
    }

    return (
      <React.Fragment>
        {filteredLanguages.suggested.map(this.renderLanguageItem.bind(this))}
        <bem.LanguageSelector__line/>
      </React.Fragment>
    )
  }

  renderSearchForm() {
    const filteredLanguages = this.getFilteredLanguages()

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
          {(
            filteredLanguages.suggested.length === 0 &&
            filteredLanguages.other.length === 0
          ) &&
            <bem.LanguageSelector__notFoundMessage key='empty'>
              {t("Sorry, didn't find any language…")}
            </bem.LanguageSelector__notFoundMessage>
          }

          {this.renderSuggestedLanguages()}
          {filteredLanguages.other.length >= 1 &&
            filteredLanguages.other.map(this.renderLanguageItem.bind(this))
          }

          {this.isCustomLanguageVisible() &&
            <li key='custom'>
              <Button
                type='bare'
                color='storm'
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
