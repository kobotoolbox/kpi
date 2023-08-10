import React from 'react';
import TextareaAutosize from 'react-autosize-textarea';
import styles from './textBox.module.scss';
import classnames from 'classnames';

type TextBoxType = 'email' | 'number' | 'password' | 'text-multiline' | 'text' | 'url';

const DefaultType: TextBoxType = 'text';

interface TextBoxProps {
  type?: TextBoxType;
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
  readOnly?: boolean;
  disabled?: boolean;
  customClassNames?: string[];
  'data-cy'?: string;
}

/**
 * A generic text box component. It relies on parent to handle all the data
 * updates.
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

  const rootClassNames = props.customClassNames || [];
  rootClassNames.push(styles.root);

  let errors = [];
  if (Array.isArray(props.errors)) {
    errors = props.errors;
  } else if (typeof props.errors === 'string' && props.errors.length > 0) {
    errors.push(props.errors);
  }
  if (errors.length > 0 || props.errors === true) {
    rootClassNames.push(styles.hasError);
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
    <label className={classnames(rootClassNames)}>
      {props.label &&
        <div className={styles.label}>
          {props.label}
        </div>
      }

      {props.type === 'text-multiline' &&
        <TextareaAutosize
          className={styles.input}
          {...inputProps}
        />
      }
      {props.type !== 'text-multiline' &&
        <input
          className={styles.input}
          type={type}
          {...inputProps}
        />
      }

      {errors.length > 0 &&
        <section className={styles.errorMessages}>
          {errors.map((message: string, index: number) => (
            <div key={`textbox-error-${index}`}>{message}</div>
          ))}
        </section>
      }
    </label>
  );
}
