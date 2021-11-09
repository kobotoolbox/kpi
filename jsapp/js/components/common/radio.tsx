import React from 'react';
import autoBind from 'react-autobind';
import bem from 'js/bem';

interface RadioOption {
  label: string
  value: string
}

type RadioProps = {
  options: RadioOption[]
  title?: string
  name: string
  onChange: Function
  selected: string
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
      <bem.Radio>
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
                onChange={this.onChange}
                checked={this.props.selected === option.value}
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
