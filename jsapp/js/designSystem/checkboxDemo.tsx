import React from 'react'
import bem from 'js/bem';
import Checkbox from 'js/components/common/checkbox'
import TextBox from 'js/components/common/textBox'

type CheckboxDemoState = {
  demoLabel: string
  demoIsDisabled: boolean
  demoIsChecked: boolean
}

const defaultLabel = 'I approve'

export default class CheckboxDemo extends React.Component<{}, CheckboxDemoState> {
  constructor(props: {}) {
    super(props)
    this.state = {
      demoLabel: defaultLabel,
      demoIsDisabled: false,
      demoIsChecked: false,
    }
  }

  onLabelChange(newLabel: string) {
    this.setState({demoLabel: newLabel})
  }

  onIsDisabledChange(isChecked: boolean) {
    this.setState({demoIsDisabled: isChecked})
  }

  onIsCheckedChange(isChecked: boolean) {
    this.setState({demoIsChecked: isChecked})
  }

  render() {
    return (
      <section>
        <h1><code>&lt;Checkbox&gt;</code> component</h1>

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
                        label='text'
                        customModifiers='on-white'
                        onChange={this.onLabelChange.bind(this)}
                        value={this.state.demoLabel}
                      />
                    </div>

                    <div className='demo__form-config'>
                      <Checkbox
                        label='is disabled'
                        onChange={this.onIsDisabledChange.bind(this)}
                        checked={this.state.demoIsDisabled}
                      />
                    </div>

                    <div className='demo__form-config'>
                      <Checkbox
                        label='is checked'
                        onChange={this.onIsCheckedChange.bind(this)}
                        checked={this.state.demoIsChecked}
                      />
                    </div>
                  </div>
                </form>
              </bem.SimpleTable__cell>
              <bem.SimpleTable__cell>
                <div className='demo__preview'>
                  <Checkbox
                    label={this.state.demoLabel}
                    disabled={this.state.demoIsDisabled}
                    checked={this.state.demoIsChecked}
                    onChange={this.onIsCheckedChange.bind(this)}
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
