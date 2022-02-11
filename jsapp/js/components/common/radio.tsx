import React from 'react';
import autoBind from 'react-autobind';
import bem from 'js/bem';

export interface RadioOption {
  label: string
  value: string
  /** Disables just this option. */
  isDisabled?: boolean
}

type RadioProps = {
  options: RadioOption[]
  /** Displays a label/title on top of the radio options. */
  title?: string
  /** Internal ID useful for the identification of radio. */
  name: string
  onChange: Function
  /** The `value` of selected option. */
  selected: string
  /** Disables whole radio component. */
  isDisabled?: boolean
}

/** A radio input generic component. */
class Radio extends React.Component<RadioProps> {
  constructor(props: RadioProps){
    if (typeof props.onChange !== 'function') {
      throw new Error('onChange callback missing!');
    }
    super(props);
    autoBind(this);
  }

  onChange(evt: React.ChangeEvent<HTMLInputElement>) {
    this.props.onChange(
      evt.currentTarget.name,
      evt.currentTarget.value
    );
  }

  render() {
    return (
      <bem.Radio m={{'disabled': Boolean(this.props.isDisabled)}}>
        {this.props.title &&
          <bem.Radio__row m='title'>{this.props.title}</bem.Radio__row>
        }
        {this.props.options.map((option) => {
          return (
            <bem.Radio__row key={option.value}>
              <bem.Radio__input
                type='radio'
                value={option.value}
                name={this.props.name}
                onChange={this.onChange.bind(this)}
                checked={this.props.selected === option.value}
                disabled={this.props.isDisabled || option.isDisabled}
              />

              <bem.Radio__label>
                {option.label}
              </bem.Radio__label>
            </bem.Radio__row>
          );
        })}
      </bem.Radio>
    );
  }
}

export default Radio;
