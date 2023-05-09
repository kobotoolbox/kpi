import React from 'react';
import bem from 'js/bem';
import TextareaAutosize from 'react-autosize-textarea';
import './textBox.scss';

export type AvailableType = 'email' | 'number' | 'password' | 'text-multiline' | 'text' | 'url';

const DefaultType: AvailableType = 'text';

interface TextBoxProps {
  type?: AvailableType;
  value: string;
  /** Not needed if `readOnly` */
  onChange?: Function;
  onBlur?: Function;
  onKeyPress?: Function;
  /**
   * Visual error indication and displaying error messages. Pass `true` to make
   * the input red. Pass string or multiple strings to also display
   * the error message(s).
   */
  errors?: string[] | boolean | string;
  label?: string;
  placeholder?: string;
  description?: string;
  readOnly?: boolean;
  disabled?: boolean;
  customModifiers?: string[]|string;
  'data-cy'?: string;
  /** Gives focus to the input immediately after rendering */
  renderFocused?: boolean;
}

/**
 * A text box generic component.
 */
class TextBox extends React.Component<TextBoxProps, {}> {
  inputReference: React.MutableRefObject<null | HTMLInputElement>;
  textareaReference: React.MutableRefObject<null | HTMLTextAreaElement>;

  constructor(props: TextBoxProps) {
    super(props);
    this.inputReference = React.createRef();
    this.textareaReference = React.createRef();
  }

  componentDidMount() {
    if (this.props.renderFocused) {
      this.inputReference.current?.focus();
      this.textareaReference.current?.focus();
    }
  }

  /**
   * NOTE: I needed to set `| any` for `onChange`, `onBlur` and `onKeyPress`
   * types to stop TextareaAutosize complaining.
   */

  onValueChange(newValue: string) {
    if (this.props.readOnly || !this.props.onChange) {
      return;
    }

    this.props.onChange(newValue);
  }

  onBlur(evt: React.FocusEvent<HTMLInputElement> | React.FocusEvent<HTMLTextAreaElement>) {
    if (typeof this.props.onBlur === 'function') {
      this.props.onBlur(evt.currentTarget.value);
    }
  }

  onKeyPress(evt: React.KeyboardEvent<HTMLInputElement> | React.KeyboardEvent<HTMLTextAreaElement>) {
    // For `number` type, we disallow any non numeric characters.
    if (
      this.props.type === 'number' &&
      !['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(evt.key)
    ) {
      evt.preventDefault();
      return false;
    }

    if (typeof this.props.onKeyPress === 'function') {
      this.props.onKeyPress(evt.key, evt);
    }
    return true;
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

    let type = DefaultType;
    if (this.props.type) {
      type = this.props.type;
    }

    // Shared props for both `<TextareaAutosize>` and `<input>`. The reason we
    // need this is because for `text-multiline` type we use special component,
    // and for all the other types we use the `<input>` HTML tag.
    const inputProps = {
      value: this.props.value,
      placeholder: this.props.placeholder,
      onBlur: this.onBlur.bind(this),
      onKeyPress: this.onKeyPress.bind(this),
      readOnly: this.props.readOnly,
      disabled: this.props.disabled,
      'data-cy': this.props['data-cy'],
      // For `number` type we allow only positive integers
      step: this.props.type === 'number' ? 1 : undefined,
      min: this.props.type === 'number' ? 0 : undefined,
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
            ref={this.textareaReference}
            onChange={(evt: React.FormEvent<HTMLTextAreaElement>) => {
              this.onValueChange(evt.currentTarget.value);
            }}
            {...inputProps}
          />
        }
        {this.props.type !== 'text-multiline' &&
          <input
            className='text-box__input'
            type={type}
            ref={this.inputReference}
            // We use `onInput` instead of `onChange` here, because (for some
            // reason I wasn't able to grasp) `input[type="number"]` is not
            // calling onChange when non-number is typed, but regardless to that
            // the non-number character ends up added to the input value.
            // This happens on Firefox.
            onInput={(evt: React.ChangeEvent<HTMLInputElement>) => {
              this.onValueChange(evt.currentTarget.value);
            }}
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
            {errors.map((message: string, index: number) => (
              <div key={`textbox-error-${index}`}>{message}</div>
            ))}
          </bem.TextBox__error>
        }
      </bem.TextBox>
    );
  }
}

export default TextBox;
