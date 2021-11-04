import React, {ReactElement} from 'react'
import Select from 'react-select'
import bem from 'js/bem';
import Checkbox from 'js/components/common/checkbox'
import TextBox from 'js/components/common/textBox'
import Button, {ButtonType, ButtonColor, ButtonSize} from 'js/components/common/button'
import {IconNames} from 'jsapp/fonts/k-icons'

const buttonTypes: ButtonType[] = ['bare', 'frame', 'full']
const buttonColors: ButtonColor[] = ['blue', 'teal', 'green', 'red', 'orange', 'gray']
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
  currentType: ButtonType
  currentColor: ButtonColor
  currentSize: ButtonSize
  currentStartIcon: IconNameOption | null
  currentEndIcon: IconNameOption | null
  currentLabel: string
  currentTooltip: string
  isDisabled: boolean
  isPending: boolean
  isFullWidth: boolean
}

type SelectTypeOption = {
  value: ButtonType,
  label: ButtonType
}

type SelectColorOption = {
  value: ButtonColor,
  label: ButtonColor
}

type SelectSizeOption = {
  value: ButtonSize,
  label: ButtonSize
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

export default class DesignSystemRoute extends React.Component<{}, ButtonDemoState> {
  constructor(props: {}) {
    super(props)
    this.state = {
      currentType: 'full',
      currentColor: 'teal',
      currentSize: 'l',
      currentStartIcon: null,
      currentEndIcon: null,
      currentLabel: defaultLabel,
      currentTooltip: '',
      isDisabled: false,
      isPending: false,
      isFullWidth: false,
    }
  }

  onTypeChange(newType: SelectTypeOption | null) {
    this.setState({
      currentType: newType === null ? buttonTypes[0] : newType.value
    })
  }

  onColorChange(newColor: SelectColorOption | null) {
    this.setState({
      currentColor: newColor === null ? buttonColors[0] : newColor.value
    })
  }

  onSizeChange(newSize: SelectSizeOption | null) {
    this.setState({
      currentSize: newSize === null ? buttonSizes[0] : newSize.value
    })
  }

  onStartIconChange(newStartIcon: IconNameOption | null) {
    this.setState({
      currentStartIcon: newStartIcon ? newStartIcon : null,
      // Only one of icons is allowed.
      currentEndIcon: newStartIcon ? null : this.state.currentEndIcon
    })
  }

  onEndIconChange(newEndIcon: IconNameOption | null) {
    this.setState({
      currentEndIcon: newEndIcon ? newEndIcon : null,
      // Only one of icons is allowed.
      currentStartIcon: newEndIcon ? null : this.state.currentStartIcon
    })
  }

  onLabelChange(newLabel: string) {
    this.setState({
      currentLabel: newLabel,
      // If there is no label, icon is required
      currentStartIcon: newLabel === '' ? defaultIcon : this.state.currentStartIcon
    })
  }

  onTooltipChange(newTooltip: string) {
    this.setState({currentTooltip: newTooltip})
  }

  onIsDisabledChange(isChecked: boolean) {
    this.setState({isDisabled: isChecked})
  }

  onIsPendingChange(isChecked: boolean) {
    this.setState({isPending: isChecked})
  }

  onIsFullWidthChange(isChecked: boolean) {
    this.setState({isFullWidth: isChecked})
  }

  render() {
    return (
      <section>
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
                  <label htmlFor='type'>type</label>
                  <Select
                    id='type'
                    className='kobo-select'
                    classNamePrefix='kobo-select'
                    value={{
                      value: this.state.currentType,
                      label: this.state.currentType
                    }}
                    isClearable={false}
                    options={buttonTypes.map(
                      (type: ButtonType) => {return {value: type, label: type}}
                    )}
                    onChange={this.onTypeChange.bind(this)}
                  />
                  <label htmlFor='color'>color</label>
                  <Select
                    id='color'
                    className='kobo-select'
                    classNamePrefix='kobo-select'
                    value={{
                      value: this.state.currentColor,
                      label: this.state.currentColor
                    }}
                    isClearable={false}
                    options={buttonColors.map(
                      (type: ButtonColor) => {return {value: type, label: type}}
                    )}
                    onChange={this.onColorChange.bind(this)}
                  />
                  <label htmlFor='size'>size</label>
                  <Select
                    id='size'
                    className='kobo-select'
                    classNamePrefix='kobo-select'
                    value={{
                      value: this.state.currentSize,
                      label: this.state.currentSize
                    }}
                    isClearable={false}
                    options={buttonSizes.map(
                      (type: ButtonSize) => {return {value: type, label: type}}
                    )}
                    onChange={this.onSizeChange.bind(this)}
                  />
                  <label htmlFor='start-icon'>start icon</label>
                  <Select
                    inputId='start-icon'
                    className='kobo-select'
                    classNamePrefix='kobo-select'
                    value={this.state.currentStartIcon}
                    isClearable={true}
                    options={iconNamesOptions}
                    onChange={this.onStartIconChange.bind(this)}
                  />
                  <label htmlFor='end-icon'>end icon</label>
                  <Select
                    inputId='end-icon'
                    className='kobo-select'
                    classNamePrefix='kobo-select'
                    value={this.state.currentEndIcon}
                    isClearable={true}
                    options={iconNamesOptions}
                    onChange={this.onEndIconChange.bind(this)}
                  />
                  <TextBox
                    label='text'
                    onChange={this.onLabelChange.bind(this)}
                    value={this.state.currentLabel}
                  />
                  <TextBox
                    label='tooltip'
                    onChange={this.onTooltipChange.bind(this)}
                    value={this.state.currentTooltip}
                  />
                  <Checkbox
                    label='is disabled'
                    onChange={this.onIsDisabledChange.bind(this)}
                    checked={this.state.isDisabled}
                  />
                  <Checkbox
                    label='is pending'
                    onChange={this.onIsPendingChange.bind(this)}
                    checked={this.state.isPending}
                  />
                  <Checkbox
                    label='is full width'
                    onChange={this.onIsFullWidthChange.bind(this)}
                    checked={this.state.isFullWidth}
                  />
                </form>
              </bem.SimpleTable__cell>
              <bem.SimpleTable__cell>
                <Button
                  type={this.state.currentType}
                  color={this.state.currentColor}
                  size={this.state.currentSize}
                  startIcon={this.state.currentStartIcon?.value}
                  endIcon={this.state.currentEndIcon?.value}
                  label={this.state.currentLabel}
                  tooltip={this.state.currentTooltip}
                  isDisabled={this.state.isDisabled}
                  isPending={this.state.isPending}
                  isFullWidth={this.state.isFullWidth}
                  onClick={() => void 0}
                />
              </bem.SimpleTable__cell>
            </bem.SimpleTable__row>
          </bem.SimpleTable__body>
        </bem.SimpleTable>
      </section>
    )
  }
}
