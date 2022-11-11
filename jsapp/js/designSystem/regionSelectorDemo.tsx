import React from 'react';
import bem from 'js/bem';
import TextBox from 'js/components/common/textBox';
import Checkbox from 'js/components/common/checkbox';
import RegionSelector from 'js/components/languages/regionSelector';
import type {LanguageCode} from 'js/components/languages/languagesStore';

interface LanguageSelectorDemoState {
  demoIsDisabled: boolean;
  demoRootLanguage: string;
}

export default class RegionSelectorDemo extends React.Component<{}, LanguageSelectorDemoState> {
  constructor(props: {}) {
    super(props);
    this.state = {
      demoIsDisabled: false,
      demoRootLanguage: 'en',
    };
  }

  onCancel() {
    console.log('cancelled');
  }

  onRegionChange(selectedRegion: LanguageCode | null) {
    console.log('region changed', selectedRegion);
  }

  onRootLanguageChange(newRootLanguage: string) {
    this.setState({demoRootLanguage: newRootLanguage});
  }

  onIsDisabledChange(isChecked: boolean) {
    this.setState({demoIsDisabled: isChecked});
  }

  render() {
    return (
      <section>
        <h1><code>&lt;RegionSelector&gt;</code> component</h1>

        <bem.SimpleTable>
          <bem.SimpleTable__header>
            <bem.SimpleTable__row>
              <bem.SimpleTable__cell>configuration</bem.SimpleTable__cell>
              <bem.SimpleTable__cell>live view</bem.SimpleTable__cell>
            </bem.SimpleTable__row>
          </bem.SimpleTable__header>
          <bem.SimpleTable__body>
            <bem.SimpleTable__row>
              <bem.SimpleTable__cell m='align-top'>
                <form>
                  <div className='demo__form-row'>
                    <div className='demo__form-config'>
                      <TextBox
                        value={this.state.demoRootLanguage}
                        placeholder='language code'
                        onChange={this.onRootLanguageChange.bind(this)}
                      />
                    </div>
                  </div>

                  <div className='demo__form-row'>
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
              <bem.SimpleTable__cell m='align-top'>
                <div className='demo__preview'>
                  <RegionSelector
                    isDisabled={this.state.demoIsDisabled}
                    serviceCode='goog'
                    serviceType='transcription'
                    rootLanguage={this.state.demoRootLanguage}
                    onRegionChange={this.onRegionChange.bind(this)}
                    onCancel={this.onCancel.bind(this)}
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
