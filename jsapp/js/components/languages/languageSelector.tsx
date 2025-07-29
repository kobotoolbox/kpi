import './languageSelector.scss'

import React from 'react'

import debounce from 'lodash.debounce'
import { observer } from 'mobx-react'
import type { RefObject } from 'react'

import InfiniteScroll from 'react-infinite-scroller'
import bem, { makeBem } from '#/bem'
import Button from '#/components/common/button'
import Icon from '#/components/common/icon'
import LoadingSpinner from '#/components/common/loadingSpinner'
import envStore from '#/envStore'
import LanguagesListStore from './languagesListStore'
import languagesStore from './languagesStore'
import type { DetailedLanguage, LanguageCode, ListLanguage } from './languagesStore'
import { LanguageDisplayLabel } from './languagesUtils'

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
bem.LanguageSelector__notFoundMessage = makeBem(bem.LanguageSelector, 'not-found-message', 'li')
bem.LanguageSelector__helpBar = makeBem(bem.LanguageSelector, 'help-bar', 'footer')

const LANGUAGE_SELECTOR_SUPPORT_URL = 'transcription-translation.html#language-list'

const LANGUAGE_SELECTOR_RESET_EVENT = 'LanguageSelector:resetall'

const MINIMUM_SEARCH_LENGTH = 2

/** Use this function to reset all LanguageSelectors :) */
export function resetAllLanguageSelectors() {
  const event = new CustomEvent(LANGUAGE_SELECTOR_RESET_EVENT)
  document.dispatchEvent(event)
}

interface LanguageSelectorProps {
  /** Replaces the title on top. */
  titleOverride?: string
  /**
   * Useful for translations (adds some UI). Also the source language is
   * not selectable from the list.
   */
  sourceLanguage?: LanguageCode
  /**
   * A list of languages that should be displayed in front of other languages.
   * Most possibly these languages were already chosen for other parts of given
   * feature or can be found in existing data.
   */
  suggestedLanguages?: LanguageCode[]
  /** A list of languages that should be omitted from display. */
  hiddenLanguages?: LanguageCode[]
  /** Triggered after language is selected or cleared. */
  onLanguageChange: (selectedLanguage: DetailedLanguage | ListLanguage | null) => void
  isDisabled?: boolean
}

interface LanguageSelectorState {
  searchPhrase: string
  sourceLanguage?: DetailedLanguage
  /**
   * A list of language objects. We use `languagesStore` to get the
   * necessary data. Due to memoization and how the app is built, all of these
   * languages should be already available (i.e. no fetching needed).
   */
  suggestedLanguages?: DetailedLanguage[]
  selectedLanguage: DetailedLanguage | ListLanguage | null
}

/**
 * A complex language selector component with some features:
 * - source language
 * - huge searchable list of languages
 * - regions (TBD)
 */
class LanguageSelector extends React.Component<LanguageSelectorProps, LanguageSelectorState> {
  store = new LanguagesListStore()
  clearSelectedLanguageBound = this.clearSelectedLanguage.bind(this)
  fetchLanguagesDebounced = debounce(this.fetchLanguages, 300)
  listRef: RefObject<HTMLElement>

  constructor(props: LanguageSelectorProps) {
    super(props)
    this.state = {
      searchPhrase: '',
      selectedLanguage: null,
    }
    this.listRef = React.createRef()
  }

  componentDidMount() {
    document.addEventListener(LANGUAGE_SELECTOR_RESET_EVENT, this.clearSelectedLanguageBound)

    // Make initial fetch with no search phrase.
    this.fetchLanguages()

    if (this.props.sourceLanguage) {
      this.fetchSourceLanguage()
    }

    if (this.props.suggestedLanguages) {
      this.fetchSuggestedLanguages()
    }
  }

  componentWillUnmount() {
    document.removeEventListener(LANGUAGE_SELECTOR_RESET_EVENT, this.clearSelectedLanguageBound)
  }

  componentDidUpdate(prevProps: LanguageSelectorProps) {
    if (prevProps.sourceLanguage !== this.props.sourceLanguage) {
      this.fetchSourceLanguage()
    }
    if (prevProps.suggestedLanguages !== this.props.suggestedLanguages) {
      this.fetchSuggestedLanguages()
    }
  }

  notifyParentComponent() {
    this.props.onLanguageChange(this.state.selectedLanguage)
  }

  openSupportPage() {
    window.open(envStore.data.support_url + LANGUAGE_SELECTOR_SUPPORT_URL, '_blank')
  }

  /** Initializes search on `languageStore` with current `searchPhrase`. */
  fetchLanguages() {
    this.store.fetchLanguages(this.state.searchPhrase)
    // Reset scroll position to top whenever a fresh list is being fetched
    // (unlike fetching more languages, when we don't want to reset anything).
    if (this.listRef.current) {
      this.listRef.current.scrollTop = 0
    }
  }

  fetchMoreLanguages() {
    this.store.fetchMoreLanguages()
  }

  async fetchSourceLanguage() {
    this.setState({ sourceLanguage: undefined })
    if (this.props.sourceLanguage) {
      try {
        const language = await languagesStore.getLanguage(this.props.sourceLanguage)
        // Just a safe check if source didn't change as we waited for the response.
        if (this.props.sourceLanguage === language.code) {
          this.setState({ sourceLanguage: language })
        }
      } catch (error) {
        console.error(`Language ${this.props.sourceLanguage} not found 1`)
      }
    }
  }

  async fetchSuggestedLanguages() {
    this.setState({ suggestedLanguages: undefined })
    if (this.props.suggestedLanguages) {
      const languages = await Promise.all(
        this.props.suggestedLanguages.map(async (languageCode) => {
          try {
            return await languagesStore.getLanguage(languageCode)
          } catch (error) {
            console.error(`Language ${languageCode} not found 2`)
            return null
          }
        }),
      )
      const suggestedLanguages = languages.filter((language) => language !== null)
      this.setState({ suggestedLanguages })
    }
  }

  onSearchPhraseInputChange(evt: React.ChangeEvent<HTMLInputElement>) {
    this.setSearchPhrase(evt.target.value)
  }

  clearSearchPhrase() {
    this.setSearchPhrase('', true)
  }

  setSearchPhrase(searchPhrase: string, forceFetch?: boolean) {
    this.setState({ searchPhrase: searchPhrase })
    if (forceFetch || searchPhrase.length >= MINIMUM_SEARCH_LENGTH) {
      this.fetchLanguagesDebounced()
    }
  }

  selectLanguage(language: DetailedLanguage | ListLanguage) {
    this.setState({ selectedLanguage: language }, this.notifyParentComponent.bind(this))
  }

  clearSelectedLanguage() {
    this.setState({ selectedLanguage: null }, this.notifyParentComponent.bind(this))
  }

  get isCannotFindVisible() {
    // We want to display this information only after user have used the search
    // feature and went through the whole list of results. Or if there are no
    // results for given phrase.
    return this.state.searchPhrase && !this.store.isLoading && !this.store.hasMoreLanguages
  }

  /**
   * We need to filter out some languages from the list, so we use this neat
   * little alias to `this.store.languages`.
   */
  get languages() {
    return this.store.languages.filter(
      (language) =>
        !this.props.suggestedLanguages?.includes(language.code) &&
        !this.props.hiddenLanguages?.includes(language.code) &&
        language.code !== this.props.sourceLanguage,
    )
  }

  /**
   * We need to filter out some languages from the list, so we use this neat
   * little alias to `this.state.suggestedLanguages`.
   */
  get suggestedLanguages() {
    return (
      this.state.suggestedLanguages?.filter(
        (language) =>
          !this.props.hiddenLanguages?.includes(language.code) && language.code !== this.props.sourceLanguage,
      ) || []
    )
  }

  get featuredLanguages() {
    return this.languages.filter((language) => language.featured)
  }

  /** Languages that are not featured. */
  get otherLanguages() {
    return this.languages.filter((language) => !language.featured)
  }

  renderLanguageItem(language: DetailedLanguage | ListLanguage) {
    return (
      <li key={language.code}>
        <Button
          type='text'
          size='m'
          label={<LanguageDisplayLabel code={language.code} name={language.name} />}
          onClick={this.selectLanguage.bind(this, language)}
          isDisabled={this.props.isDisabled}
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
        <Icon name='language-alt' size='m' />

        <bem.LanguageSelector__selectedLanguageLabel title={t('Selected language')}>
          <LanguageDisplayLabel code={this.state.selectedLanguage.code} name={this.state.selectedLanguage.name} />
        </bem.LanguageSelector__selectedLanguageLabel>

        <bem.LanguageSelector__clearSelectedLanguage
          onClick={this.clearSelectedLanguage.bind(this)}
          disabled={this.props.isDisabled}
          title={t('Clear selected language')}
        >
          <Icon name='close' size='s' />
        </bem.LanguageSelector__clearSelectedLanguage>
      </bem.LanguageSelector__selectedLanguage>
    )
  }

  renderSourceLanguage() {
    if (!this.state.sourceLanguage) {
      return null
    }

    return (
      <bem.LanguageSelector__source>
        <bem.LanguageSelector__sourceLabel>{t('original')}</bem.LanguageSelector__sourceLabel>

        <bem.LanguageSelector__sourceLanguage>
          <Icon name='language-alt' size='m' />
          <LanguageDisplayLabel code={this.state.sourceLanguage.code} name={this.state.sourceLanguage.name} />
        </bem.LanguageSelector__sourceLanguage>
      </bem.LanguageSelector__source>
    )
  }

  renderSearchBox() {
    return (
      <bem.LanguageSelector__searchBoxWrapper>
        {this.state.sourceLanguage && (
          <bem.LanguageSelector__searchBoxLabel>{t('translation')}</bem.LanguageSelector__searchBoxLabel>
        )}
        <bem.LanguageSelector__searchBox>
          {this.store.isLoading && <Icon name='spinner' size='s' className='k-spin' />}
          {!this.store.isLoading && <Icon name='search' size='m' />}

          <bem.LanguageSelector__searchBoxInput
            type='search'
            role='searchbox'
            value={this.state.searchPhrase}
            onChange={this.onSearchPhraseInputChange.bind(this)}
            placeholder={t('Search for a language')}
            disabled={this.props.isDisabled}
          />

          {this.state.searchPhrase !== '' && (
            <bem.LanguageSelector__clearSearchBox
              onClick={this.clearSearchPhrase.bind(this)}
              disabled={this.props.isDisabled}
              title={t('Clear search')}
            >
              <Icon name='close' size='s' />
            </bem.LanguageSelector__clearSearchBox>
          )}
        </bem.LanguageSelector__searchBox>
      </bem.LanguageSelector__searchBoxWrapper>
    )
  }

  renderSearchForm() {
    return (
      <React.Fragment>
        <bem.LanguageSelector__searchBoxRow>
          {this.state.sourceLanguage && (
            <React.Fragment>
              {this.renderSourceLanguage()}
              <Icon name='arrow-right' size='l' />
            </React.Fragment>
          )}
          {this.renderSearchBox()}
        </bem.LanguageSelector__searchBoxRow>

        <section className='language-selector__list' ref={this.listRef}>
          <InfiniteScroll
            pageStart={0}
            loadMore={this.fetchMoreLanguages.bind(this)}
            hasMore={this.store.hasMoreLanguages}
            loader={<LoadingSpinner message={false} key='loadingspinner' />}
            useWindow={false}
          >
            <ul key='unorderedlist'>
              {this.suggestedLanguages.map(this.renderLanguageItem.bind(this))}
              {this.featuredLanguages.map(this.renderLanguageItem.bind(this))}
              {/*
                NOTE: here we assume there will always be at least 1 featured
                language, thus always displaying the separator linge.
              */}
              {this.store.isInitialised && <bem.LanguageSelector__line />}
              {this.otherLanguages.map(this.renderLanguageItem.bind(this))}
            </ul>
          </InfiniteScroll>

          {this.state.searchPhrase !== '' && this.store.isInitialised && this.languages.length === 0 && (
            <bem.LanguageSelector__notFoundMessage key='empty'>
              {t("Sorry, didn't find any language…")}
            </bem.LanguageSelector__notFoundMessage>
          )}
        </section>

        {this.isCannotFindVisible && (
          <bem.LanguageSelector__helpBar>
            <Button
              type='text'
              startIcon='information'
              size='s'
              onClick={this.openSupportPage.bind(this)}
              label={t('I cannot find my language')}
            />
          </bem.LanguageSelector__helpBar>
        )}
      </React.Fragment>
    )
  }

  render() {
    return (
      <bem.LanguageSelector>
        <bem.LanguageSelector__title>
          {this.props.titleOverride ? this.props.titleOverride : t('Please select the language')}
        </bem.LanguageSelector__title>

        {this.state.selectedLanguage && this.renderSelectedLanguage()}

        {!this.state.selectedLanguage && this.renderSearchForm()}
      </bem.LanguageSelector>
    )
  }
}

export default observer(LanguageSelector)
