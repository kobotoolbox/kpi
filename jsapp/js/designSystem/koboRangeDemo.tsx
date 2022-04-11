import React from 'react'
import bem from 'js/bem';
import KoboRange, {KoboRangeColors} from 'js/components/common/koboRange'
import TextBox from 'js/components/common/textBox'
import Checkbox from 'js/components/common/checkbox'
import Radio from 'js/components/common/radio'

type KoboRangeDemoState = {
  demoTotalLabel: string
  demoCurrentLabel: string
  demoColor: KoboRangeColors
  demoMax: number
  demoIsTime: boolean
  demoIsDisabled: boolean
  value: number
}

interface Option {
  value: string
  label: string
}

const colorsOptions: Option[] = []
for (let color in KoboRangeColors) {
  // Hacking TypeScript: https://stackoverflow.com/a/51281023/2311247
  const typedColor: KoboRangeColors = KoboRangeColors[color as keyof typeof KoboRangeColors]
  colorsOptions.push({
    label: typedColor,
    value: typedColor
  })
}

export default class KoboRangeDemo extends React.Component<{}, KoboRangeDemoState> {
  constructor(props: {}) {
    super(props)
    this.state = {
      demoTotalLabel: '',
      demoCurrentLabel: '',
      demoColor: KoboRangeColors.default,
      demoMax: 10,
      demoIsTime: false,
      demoIsDisabled: false,
      value: 4
    }
  }

  onTotalLabelChange(newLabel: string) {
    this.setState({demoTotalLabel: newLabel})
  }

  onCurrentLabelChange(newLabel: string) {
    this.setState({demoCurrentLabel: newLabel})
  }

  onColorChange({}: any, newColor: KoboRangeColors) {
    this.setState({demoColor: newColor})
  }

  onMaxChange(newMax: number) {
    this.setState({demoMax: newMax})
  }

  onIsTimeChange(isChecked: boolean) {
    this.setState({demoIsTime: isChecked})
  }

  onIsDisabledChange(isChecked: boolean) {
    this.setState({demoIsDisabled: isChecked})
  }

  onValueChange(newValue: number) {
    this.setState({value: newValue})
  }

  render() {
    return (
      <section>
        <h1><code>&lt;KoboRange&gt;</code> component</h1>

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
                        label='total label (optional)'
                        customModifiers='on-white'
                        onChange={this.onTotalLabelChange.bind(this)}
                        value={this.state.demoTotalLabel}
                      />
                    </div>

                    <div className='demo__form-config'>
                      <TextBox
                        label='current label (optional)'
                        customModifiers='on-white'
                        onChange={this.onCurrentLabelChange.bind(this)}
                        value={this.state.demoCurrentLabel}
                      />
                    </div>
                  </div>

                  <div className='demo__form-row'>
                    <div className='demo__form-config'>
                      <Radio
                        title='color'
                        name='color'
                        selected={this.state.demoColor}
                        options={colorsOptions}
                        onChange={this.onColorChange.bind(this)}
                      />
                    </div>

                    <div className='demo__form-config'>
                      <TextBox
                        type='number'
                        label='max value'
                        customModifiers='on-white'
                        onChange={this.onMaxChange.bind(this)}
                        value={String(this.state.demoMax)}
                      />
                    </div>
                  </div>

                  <div className='demo__form-row'>
                    <div className='demo__form-config'>
                      <Checkbox
                        label='is time'
                        onChange={this.onIsTimeChange.bind(this)}
                        checked={this.state.demoIsTime}
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
                  <KoboRange
                    max={this.state.demoMax}
                    value={this.state.value}
                    isTime={this.state.demoIsTime}
                    isDisabled={this.state.demoIsDisabled}
                    onChange={this.onValueChange.bind(this)}
                    color={this.state.demoColor}
                    totalLabel={this.state.demoTotalLabel}
                    currentLabel={this.state.demoCurrentLabel}
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
