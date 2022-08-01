import React from 'react';
import bem from 'js/bem';
import Checkbox from 'js/components/common/checkbox';
import LanguageSelector from 'js/components/languages/languageSelector';

interface LanguageSelectorDemoState {
  demoHasSourceLanguage: boolean;
  demoHasSuggestedLanguages: boolean;
  demoIsCustomAllowed: boolean;
  demoIsDisabled: boolean;
}

export default class LanguageSelectorDemo extends React.Component<{}, LanguageSelectorDemoState> {
  constructor(props: {}) {
    super(props);
    this.state = {
      demoHasSourceLanguage: false,
      demoHasSuggestedLanguages: false,
      demoIsCustomAllowed: false,
      demoIsDisabled: false,
    };
  }

  onLanguageChange(selectedLanguage: string | undefined) {
    console.log('language change', selectedLanguage);
  }

  onHasSourceLanguageChange(isChecked: boolean) {
    this.setState({demoHasSourceLanguage: isChecked});
  }

  onHasSuggestedLanguagesChange(isChecked: boolean) {
    this.setState({demoHasSuggestedLanguages: isChecked});
  }

  onIsCustomAllowedChange(isChecked: boolean) {
    this.setState({demoIsCustomAllowed: isChecked});
  }

  onIsDisabledChange(isChecked: boolean) {
    this.setState({demoIsDisabled: isChecked});
  }

  render() {
    return (
      <section>
        <h1><code>&lt;LanguageSelector&gt;</code> component</h1>

        <p>For now demo allows to set source language to "en" and suggested languages to "fr" and "pl" pair.</p>

        <bem.SimpleTable>
          <bem.SimpleTable__header>
            <bem.SimpleTable__row>
              <bem.SimpleTable__cell>configuration</bem.SimpleTable__cell>
              <bem.SimpleTable__cell>live view</bem.SimpleTable__cell>
            </bem.SimpleTable__row>
          </bem.SimpleTable__header>
          <bem.SimpleTable__body>
            <bem.SimpleTable__row>
              <bem.SimpleTable__cell>
                <form>
                  <div className='demo__form-row'>
                    <div className='demo__form-config'>
                      <Checkbox
                        label='has suggested languages'
                        onChange={this.onHasSuggestedLanguagesChange.bind(this)}
                        checked={this.state.demoHasSuggestedLanguages}
                      />
                    </div>
                  </div>

                  <div className='demo__form-row'>
                    <div className='demo__form-config'>
                      <Checkbox
                        label='has source language'
                        onChange={this.onHasSourceLanguageChange.bind(this)}
                        checked={this.state.demoHasSourceLanguage}
                      />
                    </div>
                  </div>

                  <div className='demo__form-row'>
                    <div className='demo__form-config'>
                      <Checkbox
                        label='is custom language allowed'
                        onChange={this.onIsCustomAllowedChange.bind(this)}
                        checked={this.state.demoIsCustomAllowed}
                      />
                    </div>

                    <div className='demo__form-config'>
                      <Checkbox
                        label='is disabled'
                        onChange={this.onIsDisabledChange.bind(this)}
                        checked={this.state.demoIsDisabled}
                      />
                    </div>
                  </div>
                </form>
              </bem.SimpleTable__cell>
              <bem.SimpleTable__cell>
                <div className='demo__preview'>
                  <LanguageSelector
                    sourceLanguage={this.state.demoHasSourceLanguage ? 'en' : undefined}
                    suggestedLanguages={this.state.demoHasSuggestedLanguages ? ['pl', 'fr'] : undefined}
                    onLanguageChange={this.onLanguageChange.bind(this)}
                    isCustomAllowed={this.state.demoIsCustomAllowed}
                    isDisabled={this.state.demoIsDisabled}
                  />
                </div>
              </bem.SimpleTable__cell>
            </bem.SimpleTable__row>
          </bem.SimpleTable__body>
        </bem.SimpleTable>
      </section>
    );
  }
}
