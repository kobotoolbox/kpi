import React from 'react'
import Select from 'react-select'
import bem from 'js/bem';
import Checkbox from 'js/components/common/checkbox'
import TextBox from 'js/components/common/textBox'
import Radio from 'js/components/common/radio'
import Button, {ButtonType, ButtonColor, ButtonSize} from 'js/components/common/button'
import {IconNames} from 'jsapp/fonts/k-icons'

const buttonTypes: ButtonType[] = ['bare', 'frame', 'full']
const buttonColors: ButtonColor[] = ['blue', 'red', 'storm']
const buttonSizes: ButtonSize[] = ['s', 'm', 'l']

const iconNamesOptions: IconNameOption[] = []
for (let iconName in IconNames) {
  // Hacking TypeScript: https://stackoverflow.com/a/51281023/2311247
  const typedIconName: IconNames = IconNames[iconName as keyof typeof IconNames]
  iconNamesOptions.push({
    label: typedIconName,
    value: typedIconName
  })
}

type ButtonDemoState = {
  demoType: ButtonType
  demoColor: ButtonColor
  demoSize: ButtonSize
  demoStartIcon: IconNameOption | null
  demoEndIcon: IconNameOption | null
  demoLabel: string
  demoTooltip: string
  demoIsDisabled: boolean
  demoIsPending: boolean
  demoIsFullWidth: boolean
}

type IconNameOption = {
  value: IconNames,
  label: IconNames
}

const defaultLabel = 'click me'
const defaultIcon: IconNameOption = {
  label: IconNames.trash,
  value: IconNames.trash
}

export default class ButtonDemo extends React.Component<{}, ButtonDemoState> {
  constructor(props: {}) {
    super(props)
    this.state = {
      demoType: 'full',
      demoColor: 'blue',
      demoSize: 'l',
      demoStartIcon: null,
      demoEndIcon: null,
      demoLabel: defaultLabel,
      demoTooltip: '',
      demoIsDisabled: false,
      demoIsPending: false,
      demoIsFullWidth: false,
    }
  }

  onTypeChange({}: any, newType: ButtonType) {
    this.setState({demoType: newType})
  }

  onColorChange({}: any, newColor: ButtonColor) {
    this.setState({demoColor: newColor})
  }

  onSizeChange({}: any, newSize: ButtonSize) {
    this.setState({demoSize: newSize})
  }

  onStartIconChange(newStartIcon: IconNameOption | null) {
    this.setState({
      demoStartIcon: newStartIcon ? newStartIcon : null,
      // Only one of icons is allowed.
      demoEndIcon: newStartIcon ? null : this.state.demoEndIcon
    })
  }

  onEndIconChange(newEndIcon: IconNameOption | null) {
    this.setState({
      demoEndIcon: newEndIcon ? newEndIcon : null,
      // Only one of icons is allowed.
      demoStartIcon: newEndIcon ? null : this.state.demoStartIcon
    })
  }

  onLabelChange(newLabel: string) {
    this.setState({
      demoLabel: newLabel,
      // If there is no label, icon is required
      demoStartIcon: newLabel === '' ? defaultIcon : this.state.demoStartIcon,
      demoEndIcon: null
    })
  }

  onTooltipChange(newTooltip: string) {
    this.setState({demoTooltip: newTooltip})
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

  render() {
    return (
      <section>
        <h1><code>&lt;Button&gt;</code> component</h1>

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
                        options={buttonTypes.map(
                          (type: ButtonType) => {return {value: type, label: type}}
                        )}
                        onChange={this.onTypeChange.bind(this)}
                      />
                    </div>

                    <div className='demo__form-config'>
                      <Radio
                        title='color'
                        name='color'
                        selected={this.state.demoColor}
                        options={buttonColors.map(
                          (type: ButtonColor) => {return {value: type, label: type}}
                        )}
                        onChange={this.onColorChange.bind(this)}
                      />
                    </div>

                    <div className='demo__form-config'>
                      <Radio
                        title='size'
                        name='size'
                        selected={this.state.demoSize}
                        options={buttonSizes.map(
                          (type: ButtonSize) => {return {value: type, label: type}}
                        )}
                        onChange={this.onSizeChange.bind(this)}
                      />
                    </div>
                  </div>

                  <div className='demo__form-row'>
                    <div className='demo__form-config'>
                      <label htmlFor='start-icon'>start icon</label>
                      <Select
                        inputId='start-icon'
                        value={this.state.demoStartIcon}
                        isClearable={true}
                        options={iconNamesOptions}
                        onChange={this.onStartIconChange.bind(this)}
                      />
                    </div>

                    <div className='demo__form-config'>
                      <label htmlFor='end-icon'>end icon</label>
                      <Select
                        inputId='end-icon'
                        value={this.state.demoEndIcon}
                        isClearable={true}
                        options={iconNamesOptions}
                        onChange={this.onEndIconChange.bind(this)}
                      />
                    </div>
                  </div>

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
                      <TextBox
                        label='tooltip'
                        customModifiers='on-white'
                        onChange={this.onTooltipChange.bind(this)}
                        value={this.state.demoTooltip}
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
                  <Button
                    type={this.state.demoType}
                    color={this.state.demoColor}
                    size={this.state.demoSize}
                    startIcon={this.state.demoStartIcon?.value}
                    endIcon={this.state.demoEndIcon?.value}
                    label={this.state.demoLabel}
                    tooltip={this.state.demoTooltip}
                    isDisabled={this.state.demoIsDisabled}
                    isPending={this.state.demoIsPending}
                    isFullWidth={this.state.demoIsFullWidth}
                    onClick={() => void 0}
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
