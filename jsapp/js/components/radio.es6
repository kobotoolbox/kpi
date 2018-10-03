import React from 'react';
import autoBind from 'react-autobind';
import bem from '../bem';

/*
Properties:
- label <string>
- value <string>: required
- checked <boolean>: initial value
- onChange <function>: required
*/
class Radio extends React.Component {
  constructor(props){
    if (typeof props.onChange !== 'function') {
      throw new Error('onChange callback missing!')
    }
    super(props);
    autoBind(this);
  }

  onChange() {
    this.props.onChange(this.props.name, this.props.value);
  }

  render() {
    return (
      <bem.Radio>
        <bem.Radio__wrapper>
          <bem.Radio__input
            type='radio'
            value={this.props.value}
            name={this.props.name}
            id={this.props.id}
            onChange={this.onChange}
            checked={this.props.checked}
          />

          {this.props.label &&
            <bem.Radio__label htmlFor={this.props.id}>
              {this.props.label}
            </bem.Radio__label>
          }
        </bem.Radio__wrapper>
      </bem.Radio>
    )
  }
}

export default Radio;
