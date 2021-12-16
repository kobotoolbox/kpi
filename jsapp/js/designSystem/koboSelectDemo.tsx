import React from 'react'
import bem from 'js/bem';
import KoboSelect, {KoboSelectType} from 'js/components/common/koboSelect'
import {ButtonSize} from 'js/components/common/button'
import Checkbox from 'js/components/common/checkbox'
import Radio from 'js/components/common/radio'

const koboSelectTypes: KoboSelectType[] = ['blue', 'gray', 'outline']
const koboSelectSizes: ButtonSize[] = ['s', 'm', 'l']

type KoboSelectDemoState = {
  demoType: KoboSelectType
  demoSize: ButtonSize
  demoIsClearable: boolean
  demoIsSearchable: boolean
  demoIsDisabled: boolean
  demoIsPending: boolean
  demoIsFullWidth: boolean
  demoSelectedOption: string | null
}

export default class KoboSelectDemo extends React.Component<{}, KoboSelectDemoState> {
  constructor(props: {}) {
    super(props)
    this.state = {
      demoType: 'blue',
      demoSize: 'm',
      demoIsClearable: false,
      demoIsSearchable: false,
      demoIsDisabled: false,
      demoIsPending: false,
      demoIsFullWidth: false,
      demoSelectedOption: 'two'
    }
  }

  onTypeChange({}: any, newType: KoboSelectType) {
    this.setState({demoType: newType})
  }

  onSizeChange({}: any, newSize: ButtonSize) {
    this.setState({demoSize: newSize})
  }

  onIsClearableChange(isChecked: boolean) {
    this.setState({demoIsClearable: isChecked})
  }

  onIsSearchableChange(isChecked: boolean) {
    this.setState({demoIsSearchable: isChecked})
  }

  onIsDisabledChange(isChecked: boolean) {
    this.setState({demoIsDisabled: isChecked})
  }

  onIsPendingChange(isChecked: boolean) {
    this.setState({demoIsPending: isChecked})
  }

  onIsFullWidthChange(isChecked: boolean) {
    this.setState({demoIsFullWidth: isChecked})
  }

  onSelectChange(newSelectedOption: string | null) {
    this.setState({demoSelectedOption: newSelectedOption})
  }

  render() {
    return (
      <section>
        <h1><code>&lt;KoboSelect&gt;</code> component</h1>

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
                      <Radio
                        title='type'
                        name='type'
                        selected={this.state.demoType}
                        options={koboSelectTypes.map(
                          (type: KoboSelectType) => {return {value: type, label: type}}
                        )}
                        onChange={this.onTypeChange.bind(this)}
                      />
                    </div>

                    <div className='demo__form-config'>
                      <Radio
                        title='size'
                        name='size'
                        selected={this.state.demoSize}
                        options={koboSelectSizes.map(
                          (type: ButtonSize) => {return {value: type, label: type}}
                        )}
                        onChange={this.onSizeChange.bind(this)}
                      />
                    </div>
                  </div>

                  <div className='demo__form-row'>
                    <div className='demo__form-config'>
                      <Checkbox
                        label='is clearable'
                        onChange={this.onIsClearableChange.bind(this)}
                        checked={this.state.demoIsClearable}
                      />
                    </div>

                    <div className='demo__form-config'>
                      <Checkbox
                        label='is searchable'
                        onChange={this.onIsSearchableChange.bind(this)}
                        checked={this.state.demoIsSearchable}
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

                    <div className='demo__form-config'>
                      <Checkbox
                        label='is pending'
                        onChange={this.onIsPendingChange.bind(this)}
                        checked={this.state.demoIsPending}
                      />
                    </div>

                    <div className='demo__form-config'>
                      <Checkbox
                        label='is full width'
                        onChange={this.onIsFullWidthChange.bind(this)}
                        checked={this.state.demoIsFullWidth}
                      />
                    </div>
                  </div>
                </form>
              </bem.SimpleTable__cell>
              <bem.SimpleTable__cell>
                <div className='demo__preview'>
                  <KoboSelect
                    type={this.state.demoType}
                    size={this.state.demoSize}
                    isClearable={this.state.demoIsClearable}
                    isSearchable={this.state.demoIsSearchable}
                    isDisabled={this.state.demoIsDisabled}
                    isPending={this.state.demoIsPending}
                    isFullWidth={this.state.demoIsFullWidth}
                    options={[
                      {
                        id: 'one',
                        label: 'One',
                        icon: 'alert'
                      },
                      {
                        id: 'two',
                        label: 'Two',
                        icon: 'information'
                      },
                      {
                        id: 'three',
                        label: 'Three',
                        icon: 'information'
                      }
                    ]}
                    selectedOption={this.state.demoSelectedOption}
                    onChange={this.onSelectChange.bind(this)}
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
