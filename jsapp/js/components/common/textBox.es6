import React from 'react';
import autoBind from 'react-autobind';
import bem from 'js/bem';
import TextareaAutosize from 'react-autosize-textarea';
import './textBox.scss';

/**
 * A text box generic component.
 *
 * @prop {string} type one of AVAILABLE_TYPES, defaults to DEFAULT_TYPE
 * @prop {string} value required
 * @prop {function} onChange required
 * @prop {string[]|string|boolean} errors for visual error indication and displaying error messages
 * @prop {string} label
 * @prop {string} placeholder
 * @prop {string} description
 * @prop {boolean} readOnly
 * @prop {boolean} disabled
 * @prop {string[]|string} customModifiers
 */
class TextBox extends React.Component {
  constructor(props){
    super(props);
    this.AVAILABLE_TYPES = [
      'text-multiline',
      'text',
      'email',
      'password',
      'url',
    ];
    this.DEFAULT_TYPE = 'text';
    autoBind(this);
  }

  onChange(evt) {
    if (this.props.readOnly) {
      return;
    }
    this.props.onChange(evt.currentTarget.value);
  }

  onBlur(evt) {
    if (typeof this.props.onBlur === 'function') {
      this.props.onBlur(evt.currentTarget.value);
    }
  }

  onKeyPress(evt) {
    if (typeof this.props.onKeyPress === 'function') {
      this.props.onKeyPress(evt.key, evt);
    }
  }

  render() {
    let modifiers = [];
    if (
      Array.isArray(this.props.customModifiers) &&
      typeof this.props.customModifiers[0] === 'string'
    ) {
      modifiers = this.props.customModifiers;
    } else if (typeof this.props.customModifiers === 'string') {
      modifiers.push(this.props.customModifiers);
    }

    let errors = [];
    if (Array.isArray(this.props.errors)) {
      errors = this.props.errors;
    } else if (typeof this.props.errors === 'string' && this.props.errors.length > 0) {
      errors.push(this.props.errors);
    }
    if (errors.length > 0 || this.props.errors === true) {
      modifiers.push('error');
    }

    let type = this.DEFAULT_TYPE;
    if (this.props.type && this.AVAILABLE_TYPES.indexOf(this.props.type) !== -1) {
      type = this.props.type;
    } else if (this.props.type) {
      throw new Error(`Unknown TextBox type: ${this.props.type}!`);
    }

    const inputProps = {
      value: this.props.value,
      placeholder: this.props.placeholder,
      onChange: this.onChange,
      onBlur: this.onBlur,
      onKeyPress: this.onKeyPress,
      readOnly: this.props.readOnly,
      disabled: this.props.disabled,
    };

    return (
      <bem.TextBox m={modifiers}>
        {this.props.label &&
          <bem.TextBox__label>
            {this.props.label}
          </bem.TextBox__label>
        }

        {this.props.type === 'text-multiline' &&
          <TextareaAutosize
            className='text-box__input'
            {...inputProps}
          />
        }
        {this.props.type !== 'text-multiline' &&
          <bem.TextBox__input
            type={type}
            {...inputProps}
          />
        }

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
    );
  }
}

export default TextBox;
