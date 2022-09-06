import React from 'react';
import bem, {makeBem} from 'js/bem';
import Icon from 'js/components/common/icon';
import Button from 'js/components/common/button';
import KoboSelect from 'js/components/common/koboSelect';
import type {KoboSelectOption} from 'js/components/common/koboSelect';
import './regionSelector.scss';
import languagesStore from './languagesStore';
import type {
  DetailedLanguage,
  LanguageCode,
} from './languagesStore';

bem.RegionSelector = makeBem(null, 'region-selector', 'section');
bem.RegionSelector__loading = makeBem(bem.RegionSelector, 'loading');
bem.RegionSelector__rootLanguage = makeBem(bem.RegionSelector, 'root-language');

interface RegionSelectorProps {
  isDisabled?: boolean;
  /** The root language code of a language that possibly has regions. */
  rootLanguage: LanguageCode;
  /** Passed when a region is being selected. */
  onRegionChange: (selectedRegion: LanguageCode | null) => void;
  /** Passed when "x" next to the root language is clicked. */
  onCancel: () => void;
}

interface RegionSelectorState {
  options: KoboSelectOption[];
  selectedOption: LanguageCode | null;
  language?: DetailedLanguage;
}

export default class RegionSelector extends React.Component<
  RegionSelectorProps,
  RegionSelectorState
> {
  constructor(props: RegionSelectorProps){
    super(props);
    this.state = {
      options: [],
      selectedOption: null,
    };
  }

  componentDidMount() {
    this.fetchDetails();
  }

  componentDidUpdate(prevProps: RegionSelectorProps) {
    if (prevProps.rootLanguage !== this.props.rootLanguage) {
      this.fetchDetails();
    }
  }

  async fetchDetails() {
    // Memoization for error handling.
    const targetLanguage = this.props.rootLanguage;
    this.setState({language: undefined});
    if (targetLanguage) {
      try {
        const language = await languagesStore.getLanguage(targetLanguage);
        // Just a safe check if source didn't change as we waited for the response.
        if (this.props.rootLanguage === language.code) {
          const options = this.buildOptions(language);
          this.setState({
            language: language,
            options: options,
          });
        }
      } catch (error) {
        console.error(`Language ${targetLanguage} not found`);
      }
    }
  }

  buildOptions(language: DetailedLanguage): KoboSelectOption[] {
    const outcome = [];
    for (const region of language.regions) {
      outcome.push({
        label: region.name,
        id: region.code,
      });
    }
    return outcome;
  }

  onOptionChange(option: LanguageCode | null) {
    this.setState({selectedOption: option});
    this.props.onRegionChange(option);
  }

  render() {
    if (this.state.language === undefined) {
      return (<bem.RegionSelector__loading>…</bem.RegionSelector__loading>);
    }

    return (
      <bem.RegionSelector>
        <bem.RegionSelector__rootLanguage>
          <Icon name='language-alt'/>

          <label title={this.state.language.name}>
            {this.state.language.name}
          </label>

          <Button
            type='bare'
            color='storm'
            size='s'
            startIcon='close'
            onClick={this.props.onCancel}
            isDisabled={this.props.isDisabled}
          />
        </bem.RegionSelector__rootLanguage>

        {this.state.options.length !== 0 &&
          <KoboSelect
            name='regionselector'
            type='gray'
            size='m'
            options={this.state.options}
            selectedOption={this.state.selectedOption}
            onChange={this.onOptionChange.bind(this)}
            isDisabled={this.props.isDisabled}
          />
        }
      </bem.RegionSelector>
    );
  }
}
