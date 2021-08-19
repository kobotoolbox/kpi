import React from 'react';
import autoBind from 'react-autobind';
import bem from 'js/bem';

/**
 * @namespace RadioOption
 * @property {string} label
 * @property {string} value
 */

/**
 * A radio input generic component.
 *
 * @prop {RadioOption[]} options required
 * @prop {string} name required
 * @prop {function} onChange required
 * @prop {value} selected selected option
 */
class Radio extends React.Component {
  constructor(props){
    if (typeof props.onChange !== 'function') {
      throw new Error('onChange callback missing!');
    }
    super(props);
    autoBind(this);
  }

  onChange(evt) {
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
