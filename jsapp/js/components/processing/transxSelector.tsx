import React from 'react';
import KoboSelect from 'js/components/common/koboSelect';
import type {KoboSelectOption} from 'js/components/common/koboSelect';
import {getLanguageDisplayLabel} from 'js/components/languages/languagesUtils';
import languagesStore from 'js/components/languages/languagesStore';
import type {LanguageCode} from 'js/components/languages/languagesStore';

interface TransxSelectorProps {
  /** A list of selectable languages. */
  languageCodes: LanguageCode[];
  selectedLanguage?: LanguageCode;
  onChange: Function;
}

interface TransxSelectorState {
  selectedOption?: LanguageCode;
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
    this.state = {selectedOption: this.props.selectedLanguage};
  }

  componentDidMount() {
    this.fetchNames();
  }

  fetchNames() {
    this.setState({options: undefined});
    if (this.props.languageCodes) {
      this.props.languageCodes.forEach(async (languageCode) => {
        const languageName = await languagesStore.getLanguageName(languageCode);
        // Just a safe check if language codes list didn't change while we waited
        // for the response.
        if (this.props.languageCodes?.includes(languageCode)) {
          const newOptions = this.state.options || [];
          newOptions.push({
            id: languageCode,
            label: getLanguageDisplayLabel(languageName, languageCode),
          });
          this.setState({options: newOptions});
        }
      });
    }
  }

  get isInitialised() {
    // We fetch all necessary languages to build options. As soon as we get all
    // of them, we are ready.
    return this.props.languageCodes.length === this.state.options?.length;
  }

  onSelectChange(newSelectedOption: LanguageCode) {
    this.setState({selectedOption: newSelectedOption});
    this.props.onChange(newSelectedOption);
  }

  render() {
    if (this.state.options && this.isInitialised) {
      return (
        <KoboSelect
          name='transx-selector'
          type='blue'
          size='s'
          selectedOption={this.state.selectedOption ? this.state.selectedOption : null}
          options={this.state.options}
          onChange={this.onSelectChange.bind(this)}
        />
      );
    }

    return <span>…</span>;
  }
}
