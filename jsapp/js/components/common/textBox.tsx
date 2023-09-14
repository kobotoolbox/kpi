import React from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import styles from './textBox.module.scss';
import classnames from 'classnames';
import {ButtonToIconMap} from 'js/components/common/button';
import type {IconName} from 'jsapp/fonts/k-icons';
import Icon from './icon';

export type TextBoxType =
  | 'email'
  | 'number'
  | 'password'
  | 'text-multiline'
  | 'text'
  | 'url';

const DefaultType: TextBoxType = 'text';

interface TextBoxProps {
  type?: TextBoxType;
  /** Displays an icon inside the input, on the beginning. */
  startIcon?: IconName;
  /**
   * Displays an icon inside the input, on the end.
   * Note: Displayed only if there are no errors (in such case "alert" icon is
   * displayed instead).
   */
  endIcon?: IconName;
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
  /**
   * Makes the component visually disabled and uses the browser built-in
   * functionality
   */
  disabled?: boolean;
  /**
   * Adds required mark ("*") to the label (if label is provided).
   * Note: this adds the built-in browser required input handling, but most
   * probably there is a need for additional safety checks within the code that
   * uses this component.
   */
  required?: boolean;
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

  if (props.disabled) {
    rootClassNames.push(styles.isDisabled);
  }

  if (props.value) {
    rootClassNames.push(styles.hasValue);
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
    required: props.required,
    'data-cy': props['data-cy'],
  };

  // For now we only support one size of TextBox, but when we're going to
  // support more, we will use the same icon sizing as Button.
  const iconSize = ButtonToIconMap.get('l');

  return (
    // The whole component is a label, because clicking it will bring focus to
    // the real input inside.
    <label className={classnames(rootClassNames)}>
      {/* The label over the input */}
      {props.label && (
        <div className={styles.label}>
          {props.label}{' '}
          {props.required && <span className={styles.requiredMark}>*</span>}
        </div>
      )}

      <div className={styles.inputWrapper}>
        {/* The custom icon on the left */}
        {props.startIcon && (
          <Icon
            size={iconSize}
            name={props.startIcon}
            classNames={[styles.startIcon]}
          />
        )}

        {/* We use two different components based on the type of the TextBox */}
        {props.type === 'text-multiline' && (
          <TextareaAutosize className={styles.input} {...inputProps} />
        )}
        {props.type !== 'text-multiline' && (
          <input className={styles.input} type={type} {...inputProps} />
        )}

        {/*
          The custom icon on the right. It is being displayed only if there are
          no errors. For TextBox with error, we display always an alert icon.
        */}
        {errors.length === 0 && props.endIcon && (
          <Icon
            size={iconSize}
            name={props.endIcon}
            classNames={[styles.endIcon]}
          />
        )}
        {errors.length > 0 && (
          <Icon
            size={iconSize}
            name='alert'
            color='red'
            classNames={[styles.errorIcon]}
          />
        )}
      </div>

      {errors.length > 0 && (
        <section className={styles.errorMessages}>
          {errors.map((message: string, index: number) => (
            <div key={`textbox-error-${index}`}>{message}</div>
          ))}
        </section>
      )}
    </label>
  );
}
