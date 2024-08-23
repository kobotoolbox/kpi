import React from 'react';
import isEqual from 'lodash.isequal';
import KoboSelect from 'js/components/common/koboSelect';
import type {KoboSelectType} from 'js/components/common/koboSelect';
import type {KoboSelectOption} from 'js/components/common/koboSelect';
import {getLanguageDisplayLabel} from 'js/components/languages/languagesUtils';
import languagesStore from 'js/components/languages/languagesStore';
import type {LanguageCode} from 'js/components/languages/languagesStore';
import type {ButtonSize} from 'js/components/common/button';

interface TransxSelectorProps {
  /** A list of selectable languages. */
  languageCodes: LanguageCode[];
  selectedLanguage?: LanguageCode;
  onChange: (code: LanguageCode | null) => void;
  disabled?: boolean;
  /** Same as KoboSelect sizing */
  size: ButtonSize;
  /** Same as KoboSelect types */
  type: KoboSelectType;
}

interface TransxSelectorState {
  selectedOption: LanguageCode | null;
  options?: KoboSelectOption[];
}

/**
 * This is a wrapper component for `KoboSelect`. We need it because we only
 * have access to language codes, but we also need names for them, thus
 * `languagesStore` needs to be put into action.
 */
export default class TransxSelector extends React.Component<
  TransxSelectorProps,
  TransxSelectorState
> {
  constructor(props: TransxSelectorProps) {
    super(props);
    this.state = {selectedOption: this.props.selectedLanguage || null};
  }

  componentDidMount() {
    this.fetchNames();
  }

  componentDidUpdate(prevProps: TransxSelectorProps) {
    if (prevProps.selectedLanguage !== this.props.selectedLanguage) {
      this.setState({selectedOption: this.props.selectedLanguage || null});
    }
    if (!isEqual(this.props.languageCodes, prevProps.languageCodes)) {
      this.fetchNames();
    }
  }

  /** Rebuilds the options list by fetching all necessary names. */
  fetchNames() {
    // Start by clearing the options
    this.setState({options: undefined});
    if (this.props.languageCodes) {
      const newOptions: KoboSelectOption[] = [];
      this.props.languageCodes.forEach(async (languageCode) => {
        let languageName = languageCode;
        try {
          languageName = await languagesStore.getLanguageName(languageCode);
        } catch (error) {
          // Even if language was not found, we still proceed by adding
          // an option for it that works for user (e.g. "en (en)" would be used
          // instead of "English (en)").
          console.error(`Language ${languageCode} not found 4`);
        } finally {
          // Just a safe check if language codes list didn't change while we
          // waited for the response. And if for some crazy reason it doesn't
          // already exist in the list.
          if (
            this.props.languageCodes?.includes(languageCode) &&
            this.state.options?.find((option) => option.value === languageCode) === undefined
          ) {
            newOptions.push({
              value: languageCode,
              label: getLanguageDisplayLabel(languageName, languageCode),
            });
            // We set it here after each option, to make sure all of them end up
            // being stored.
            this.setState({options: newOptions});
          }
        }
      });
    }
  }

  get isInitialised() {
    // We fetch all necessary languages to build options. As soon as we get all
    // of them, we are ready.
    return this.props.languageCodes.length === this.state.options?.length;
  }

  onSelectChange(newSelectedOption: LanguageCode | null) {
    this.setState({selectedOption: newSelectedOption});
    this.props.onChange(newSelectedOption);
  }

  render() {
    if (this.state.options && this.isInitialised) {
      return (
        <KoboSelect
          name='transx-selector'
          type={this.props.type}
          size={this.props.size}
          selectedOption={
            this.state.selectedOption ? this.state.selectedOption : null
          }
          options={this.state.options}
          onChange={this.onSelectChange.bind(this)}
          isDisabled={this.props.disabled}
        />
      );
    }

    return <span>…</span>;
  }
}
