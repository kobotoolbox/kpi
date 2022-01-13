import React from 'react'
import bem from 'js/bem';
import Checkbox from 'js/components/common/checkbox'
import LanguageSelector from 'js/components/languages/languageSelector'

type LanguageSelectorDemoState = {
  demoHasSourceLanguage: boolean
}

export default class LanguageSelectorDemo extends React.Component<{}, LanguageSelectorDemoState> {
  constructor(props: {}) {
    super(props)
    this.state = {
      demoHasSourceLanguage: false
    }
  }

  onLanguageChange(selectedLanguage: string | undefined) {
    console.log('language change', selectedLanguage)
  }

  onHasSourceLanguageChange(isChecked: boolean) {
    this.setState({demoHasSourceLanguage: isChecked})
  }

  render() {
    return (
      <section>
        <h1><code>&lt;LanguageSelector&gt;</code> component</h1>

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
                        label='has source language'
                        onChange={this.onHasSourceLanguageChange.bind(this)}
                        checked={this.state.demoHasSourceLanguage}
                      />
                    </div>
                  </div>
                </form>
              </bem.SimpleTable__cell>
              <bem.SimpleTable__cell>
                <div className='demo__preview'>
                  <LanguageSelector
                    sourceLanguage={this.state.demoHasSourceLanguage ? 'en' : undefined}
                    onLanguageChange={this.onLanguageChange.bind(this)}
                  />
                </div>
              </bem.SimpleTable__cell>
            </bem.SimpleTable__row>
          </bem.SimpleTable__body>
        </bem.SimpleTable>
      </section>
    )
  }
}
