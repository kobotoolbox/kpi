import React from 'react';
import autoBind from 'react-autobind';
import bem from 'js/bem';
import './checkbox-and-radio.scss';

/**
 * A checkbox generic component.
 *
 * @prop {boolean} checked
 * @prop {boolean} [disabled]
 * @prop {function} onChange
 * @prop {string} label
 */
class Checkbox extends React.Component {
  constructor(props){
    if (typeof props.onChange !== 'function') {
      throw new Error('onChange callback missing!');
    }
    super(props);
    autoBind(this);
  }

  onChange(evt) {
    this.props.onChange(evt.currentTarget.checked);
  }

  render() {
    const wrapperModifiers = [];
    if (this.props.disabled) {
      // needed to disable pointer cursor
      wrapperModifiers.push('disabled');
    }

    return (
      <bem.Checkbox m={wrapperModifiers}>
        <bem.Checkbox__wrapper>
          <bem.Checkbox__input
            type='checkbox'
            name={this.props.name}
            id={this.props.id}
            onChange={this.onChange}
            checked={this.props.checked}
            disabled={this.props.disabled}
          />

          {this.props.label &&
            <bem.Checkbox__label htmlFor={this.props.id}>
              {this.props.label}
            </bem.Checkbox__label>
          }
        </bem.Checkbox__wrapper>
      </bem.Checkbox>
    );
  }
}

export default Checkbox;
