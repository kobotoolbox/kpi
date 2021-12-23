import React from 'react'
import bem from 'js/bem'
import './toggleSwitch.scss'

/**
 * A toggle switch generic component. Operates same as checkbox, different look.
 */

type ToggleSwitchProps = {
  checked?: boolean,
	label?: string,
  disabled?: boolean,
  name?: string,
  id?: number,
	onChange: Function,
}

class ToggleSwitch extends React.Component<ToggleSwitchProps, {}> {
  constructor(props: ToggleSwitchProps){
    super(props)
  }

  onChange(evt: React.ChangeEvent<HTMLInputElement>) {
    this.props.onChange(evt.currentTarget.checked)
  }

  render() {
    return (
      <bem.ToggleSwitch>
        <bem.ToggleSwitch__wrapper>
          <bem.ToggleSwitch__input
            type='checkbox'
            name={this.props.name}
            id={this.props.id}
            onChange={this.onChange.bind(this)}
            checked={this.props.checked}
            disabled={this.props.disabled}
          />
          <bem.ToggleSwitch__slider
            disabled={this.props.disabled}
          />

          {this.props.label &&
            <bem.ToggleSwitch__label htmlFor={this.props.id}>
              {this.props.label}
            </bem.ToggleSwitch__label>
          }
        </bem.ToggleSwitch__wrapper>
      </bem.ToggleSwitch>
    )
  }
}

export default ToggleSwitch
