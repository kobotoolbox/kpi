import React from 'react';
import bem from 'js/bem';
import './toggleSwitch.scss';

interface ToggleSwitchProps {
  label?: string;
  name: string;
  id: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (isChecked: boolean) => void;
  'data-cy'?: string;
}

/**
 * A toggle switch generic component. Operates same as checkbox, different look.
 *
 * @prop {boolean} checked
 * @prop {function} onChange required
 * @prop {string} label
 */
class ToggleSwitch extends React.Component<ToggleSwitchProps> {
  onChange(evt: React.ChangeEvent<HTMLInputElement>) {
    this.props.onChange(evt.currentTarget?.checked);
  }

  render() {
    return (
      <bem.ToggleSwitch>
        <bem.ToggleSwitch__wrapper>
          <bem.ToggleSwitch__input
            type='checkbox'
            name={this.props.name}
            id={this.props.id}
            onChange={this.onChange}
            checked={this.props.checked}
            disabled={this.props.disabled}
            data-cy={this.props['data-cy']}
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
    );
  }
}

export default ToggleSwitch;
