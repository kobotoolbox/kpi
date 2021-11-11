import React from 'react'
import bem from 'js/bem';
import Checkbox from 'js/components/common/checkbox'
import Radio, {RadioOption} from 'js/components/common/radio'
import TextBox from 'js/components/common/textBox'

type RadioDemoState = {
  currentTitle: string
  currentOptions: RadioOption[]
  isDisabled: boolean
  selectedOption: string
}

const defaultTitle = 'Pick your favourite food'

const defaultOptions = [
  {
    label: 'Pizza',
    value: 'pizza'
  },
  {
    label: 'Peanut butter and jelly sandwich',
    value: 'pbj_sandwich'
  },
  {
    label: 'Apple pie',
    value: 'apple_pie',
    isDisabled: true
  },
  {
    label: 'Banana',
    value: 'banana'
  },
]

export default class RadioDemo extends React.Component<{}, RadioDemoState> {
  constructor(props: {}) {
    super(props)
    this.state = {
      // Not configurable right now
      currentOptions: defaultOptions,
      currentTitle: defaultTitle,
      isDisabled: false,
      selectedOption: '',
    }
  }

  onTitleChange(newTitle: string) {
    this.setState({currentTitle: newTitle})
  }

  onIsDisabledChange(isChecked: boolean) {
    this.setState({isDisabled: isChecked})
  }

  onSelectedOptionChange(radioName: string, selectedOption: string) {
    if (radioName === 'radio-demo') {
      this.setState({selectedOption: selectedOption})
    }
  }

  render() {
    return (
      <section>
        <h1><code>&lt;Radio&gt;</code> component</h1>

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
                      <TextBox
                        label='title'
                        customModifiers='on-white'
                        onChange={this.onTitleChange.bind(this)}
                        value={this.state.currentTitle}
                      />
                    </div>

                    <div className='demo__form-config'>
                      <Checkbox
                        label='is disabled'
                        onChange={this.onIsDisabledChange.bind(this)}
                        checked={this.state.isDisabled}
                      />
                    </div>
                  </div>
                </form>
              </bem.SimpleTable__cell>
              <bem.SimpleTable__cell>
                <div className='demo__preview'>
                  <Radio
                    name='radio-demo'
                    options={this.state.currentOptions}
                    title={this.state.currentTitle}
                    isDisabled={this.state.isDisabled}
                    selected={this.state.selectedOption}
                    onChange={this.onSelectedOptionChange.bind(this)}
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
