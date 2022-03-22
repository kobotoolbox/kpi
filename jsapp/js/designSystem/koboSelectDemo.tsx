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
  demoSelectedOption: string | null
  demoOptionsWithIcons: boolean
}

export default class KoboSelectDemo extends React.Component<{}, KoboSelectDemoState> {
  constructor(props: {}) {
    super(props)
    this.state = {
      demoType: 'blue',
      demoSize: 'm',
      demoIsClearable: true,
      demoIsSearchable: true,
      demoIsDisabled: false,
      demoIsPending: false,
      demoSelectedOption: 'two',
      demoOptionsWithIcons: false
    }
  }

  onTypeChange({}: any, newType: KoboSelectType) {
    this.setState({demoType: newType})
  }

  onSizeChange({}: any, newSize: ButtonSize) {
    this.setState({demoSize: newSize})
  }

  onIsClearableChange(isChecked: boolean) {
    this.setState({
      demoSelectedOption: isChecked === false ? this.state.demoSelectedOption || 'one' : this.state.demoSelectedOption,
      demoIsClearable: isChecked
    })
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

  onOptionsWithIconsChange(isChecked: boolean) {
    this.setState({demoOptionsWithIcons: isChecked})
  }

  onSelectChange(newSelectedOption: string | null) {
    this.setState({demoSelectedOption: newSelectedOption})
  }

  render() {
    return (
      <section>
        <h1><code>&lt;KoboSelect&gt;</code> component</h1>

        <p>This component always take 100% of available space, so you need to constrain in the places you'd use it.</p>

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
                  </div>
                  <div className='demo__form-row'>
                    <div className='demo__form-config'>
                      <Checkbox
                        label='options with icons'
                        onChange={this.onOptionsWithIconsChange.bind(this)}
                        checked={this.state.demoOptionsWithIcons}
                      />
                    </div>
                  </div>
                </form>
              </bem.SimpleTable__cell>
              <bem.SimpleTable__cell>
                <div className='demo__preview'>
                  <div style={{maxWidth: '300px'}}>
                  <KoboSelect
                    name='kobo-select-demo'
                    type={this.state.demoType}
                    size={this.state.demoSize}
                    isClearable={this.state.demoIsClearable}
                    isSearchable={this.state.demoIsSearchable}
                    isDisabled={this.state.demoIsDisabled}
                    isPending={this.state.demoIsPending}
                    options={[
                      {
                        id: 'one',
                        label: 'One',
                        icon: this.state.demoOptionsWithIcons ? 'alert' : undefined
                      },
                      {
                        id: 'two',
                        label: 'Two',
                        icon: this.state.demoOptionsWithIcons ? 'qt-audio' : undefined
                      },
                      {
                        id: 'last',
                        label: 'The last one here with a very long label',
                        icon: this.state.demoOptionsWithIcons ? 'globe-alt' : undefined
                      }
                    ]}
                    selectedOption={this.state.demoSelectedOption}
                    onChange={this.onSelectChange.bind(this)}
                  />
                  </div>
                </div>
              </bem.SimpleTable__cell>
            </bem.SimpleTable__row>
          </bem.SimpleTable__body>
        </bem.SimpleTable>
      </section>
    )
  }
}
