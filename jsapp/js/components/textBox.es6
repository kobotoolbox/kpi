import React from 'react';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import bem from '../bem';
import {t} from '../utils';

/*
Properties:
- type <string>: one of AVAILABLE_TYPES, defaults to DEFAULT_TYPE
- value <string>: required
- onChange <function>: required
- errors <string[]> or <string>
- label <string>
- placeholder <string>
- description <string>
*/
class TextBox extends React.Component {
  constructor(props){
    super(props);
    this.state = {
      value: props.value,
      onChangeCallback: props.onChange
    }
    this.AVAILABLE_TYPES = [
      'text',
      'email',
      'password',
      'url'
    ];
    this.DEFAULT_TYPE = 'text';
    autoBind(this);
  }

  onChange(evt) {
    const val = evt.target.value;
    this.setState({value: val});
    this.state.onChangeCallback(val)
  }

  render() {
    let modifiers = [];

    let errors = [];
    if (Array.isArray(this.props.errors)) {
      errors = this.props.errors;
    } else if (typeof this.props.errors === 'string' && this.props.errors.length > 0) {
      errors.push(this.props.errors);
    }
    if (errors.length > 0) {
      modifiers.push('error')
    }

    let type = this.DEFAULT_TYPE;
    if (this.props.type && this.AVAILABLE_TYPES.indexOf(this.props.type) !== -1) {
      type = this.props.type;
    } else if (this.props.type) {
      throw new Error(`Unknown textBox type: ${this.props.type}!`);
    }

    return (
      <bem.TextBox m={modifiers}>
        {this.props.label &&
          <bem.TextBox__label>
            {this.props.label}
          </bem.TextBox__label>
        }

        <bem.TextBox__input
          type={type}
          value={this.state.value}
          placeholder={this.props.placeholder}
          onChange={this.onChange}
        />

        {this.props.description &&
          <bem.TextBox__description>
            {this.props.description}
          </bem.TextBox__description>
        }

        {errors.length > 0 &&
          <bem.TextBox__error>
            {errors.join('\n')}
          </bem.TextBox__error>
        }
      </bem.TextBox>
    )
  }
}

export default TextBox;
