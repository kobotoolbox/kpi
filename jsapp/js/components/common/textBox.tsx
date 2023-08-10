import React from 'react';
import bem, {makeBem} from 'js/bem';
import TextareaAutosize from 'react-autosize-textarea';
import './textBox.scss';

bem.TextBox = makeBem(null, 'text-box', 'label');
bem.TextBox__label = makeBem(bem.TextBox, 'label');
bem.TextBox__input = makeBem(bem.TextBox, 'input', 'input');
bem.TextBox__description = makeBem(bem.TextBox, 'description');
bem.TextBox__error = makeBem(bem.TextBox, 'error');

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
}

/**
 * A text box generic component.
 */
export default function TextBox(props: TextBoxProps) {
  /**
   * NOTE: I needed to set `| any` for `onChange`, `onBlur` and `onKeyPress`
   * types to stop TextareaAutosize complaining.
   */

  function onChange(evt: React.ChangeEvent<HTMLInputElement> | any) {
    if (props.readOnly || !props.onChange) {
      return;
    }
    props.onChange(evt.currentTarget.value);
  }

  function onBlur(evt: React.FocusEvent<HTMLInputElement> | any) {
    if (typeof props.onBlur === 'function') {
      props.onBlur(evt.currentTarget.value);
    }
  }

  function onKeyPress(evt: React.KeyboardEvent<HTMLInputElement> | any) {
    if (typeof props.onKeyPress === 'function') {
      props.onKeyPress(evt.key, evt);
    }
  }

  let modifiers = [];
  if (
    Array.isArray(props.customModifiers) &&
    typeof props.customModifiers[0] === 'string'
  ) {
    modifiers = props.customModifiers;
  } else if (typeof props.customModifiers === 'string') {
    modifiers.push(props.customModifiers);
  }

  let errors = [];
  if (Array.isArray(props.errors)) {
    errors = props.errors;
  } else if (typeof props.errors === 'string' && props.errors.length > 0) {
    errors.push(props.errors);
  }
  if (errors.length > 0 || props.errors === true) {
    modifiers.push('error');
  }

  let type = DefaultType;
  if (props.type) {
    type = props.type;
  }

  const inputProps = {
    value: props.value,
    placeholder: props.placeholder,
    onChange: onChange,
    onBlur: onBlur,
    onKeyPress: onKeyPress,
    readOnly: props.readOnly,
    disabled: props.disabled,
    'data-cy': props['data-cy'],
  };

  return (
    <bem.TextBox m={modifiers}>
      {props.label &&
        <bem.TextBox__label>
          {props.label}
        </bem.TextBox__label>
      }

      {props.type === 'text-multiline' &&
        <TextareaAutosize
          className='text-box__input'
          {...inputProps}
        />
      }
      {props.type !== 'text-multiline' &&
        <bem.TextBox__input
          type={type}
          {...inputProps}
        />
      }

      {props.description &&
        <bem.TextBox__description>
          {props.description}
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
