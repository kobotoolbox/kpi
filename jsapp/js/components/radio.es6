/**
 * A radio input generic component.
 *
 * Properties:
 * - options {label: <string>, value: <string>}[] - array of objects, required
 * - name <string>: required
 * - onChange <function>: required
 * - selected <value>: selected option
 *
 * TODO: would be best to move it to `jsapp/js/components/generic` directory.
 */

import React from 'react';
import autoBind from 'react-autobind';
import bem from '../bem';

class Radio extends React.Component {
  constructor(props){
    if (typeof props.onChange !== 'function') {
      throw new Error('onChange callback missing!')
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
          )
        })}
      </bem.Radio>
    )
  }
}

export default Radio;
