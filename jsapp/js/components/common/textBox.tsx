import React, {useEffect} from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import styles from './textBox.module.scss';
import classnames from 'classnames';
import type {ButtonSize} from 'js/components/common/button';
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

export type TextBoxSize = ButtonSize;

const DefaultType: TextBoxType = 'text';
const DefaultSize: TextBoxSize = 'l';

interface TextBoxProps {
  type?: TextBoxType;
  /**
   * Sizes are generally the same as in button component so we use same type.
   * Optional because we have `DefaultSize`.
   */
  size?: TextBoxSize;
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
  onChange?: (newValue: string) => void;
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
  /** Additional class name */
  className?: string;
  disableAutocomplete?: boolean;
  'data-cy'?: string;
  /** Gives focus to the input immediately after rendering */
  renderFocused?: boolean;
}

/**
 * A generic text box component. It relies on parent to handle all the data
 * updates.
 * * @deprecated Use mantine inputs
 */
export default function TextBox(props: TextBoxProps) {
  const inputReference: React.MutableRefObject<null | HTMLInputElement> =
    React.createRef();
  const textareaReference: React.MutableRefObject<null | HTMLTextAreaElement> =
    React.createRef();

  useEffect(() => {
    if (props.renderFocused) {
      inputReference.current?.focus();
      textareaReference.current?.focus();
    }
  }, []);

  function onValueChange(newValue: string) {
    if (props.readOnly || !props.onChange) {
      return;
    }
    props.onChange(newValue);
  }

  function onBlur(
    evt:
      | React.FocusEvent<HTMLInputElement>
      | React.FocusEvent<HTMLTextAreaElement>
  ) {
    if (typeof props.onBlur === 'function') {
      props.onBlur(evt.currentTarget.value);
    }
  }

  function onKeyPress(
    evt:
      | React.KeyboardEvent<HTMLInputElement>
      | React.KeyboardEvent<HTMLTextAreaElement>
  ) {
    // For `number` type, we disallow any non numeric characters.
    if (
      props.type === 'number' &&
      !['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(evt.key)
    ) {
      evt.preventDefault();
      return false;
    }

    if (typeof props.onKeyPress === 'function') {
      props.onKeyPress(evt.key, evt);
    }

    return true;
  }

  const rootClassNames = [];
  rootClassNames.push(styles.root);

  if (props.className) {
    rootClassNames.push(props.className);
  }

  let size: TextBoxSize = props.size || DefaultSize;
  switch (size) {
    case 'l':
      rootClassNames.push(styles.sizeL);
      break;
    case 'm':
      rootClassNames.push(styles.sizeM);
      break;
    case 's':
      rootClassNames.push(styles.sizeS);
      break;
  }

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

  // Shared props for both `<TextareaAutosize>` and `<input>`. The reason we
  // need this is because for `text-multiline` type we use special component,
  // and for all the other types we use the `<input>` HTML tag.
  const inputProps = {
    value: props.value,
    placeholder: props.placeholder,
    onBlur: onBlur,
    onKeyPress: onKeyPress,
    readOnly: props.readOnly,
    disabled: props.disabled,
    required: props.required,
    'data-cy': props['data-cy'],
    // For `number` type we allow only positive integers
    step: props.type === 'number' ? 1 : undefined,
    min: props.type === 'number' ? 0 : undefined,
    // All textboxes handles text direction of user content with browser
    // built-in functionality
    dir: 'auto',
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
            className={styles.startIcon}
          />
        )}
        {/* We use this to prevent browsers that ignore autocomplete='off' from attempting to fill the field */}
        {props.disableAutocomplete && <input type='password' hidden={true} />}
        {/* We use two different components based on the type of the TextBox */}
        {props.type === 'text-multiline' && (
          <TextareaAutosize
            className={styles.input}
            aria-required={props.required}
            ref={textareaReference}
            onChange={(evt: React.FormEvent<HTMLTextAreaElement>) => {
              onValueChange(evt.currentTarget.value);
            }}
            autoComplete={props.disableAutocomplete ? 'off' : 'on'}
            {...inputProps}
          />
        )}
        {props.type !== 'text-multiline' && (
          <input
            className={styles.input}
            aria-required={props.required}
            type={type}
            ref={inputReference}
            autoComplete={props.disableAutocomplete ? 'off' : 'on'}
            // We use `onInput` instead of `onChange` here, because (for some
            // reason I wasn't able to grasp) `input[type="number"]` is not
            // calling onChange when non-number is typed, but regardless to that
            // the non-number character ends up added to the input value.
            // This happens on Firefox.
            onInput={(evt: React.ChangeEvent<HTMLInputElement>) => {
              onValueChange(evt.currentTarget.value);
            }}
            // We need this fake `onChange` here to avoid React complaining that
            // we're creating a read-only input (clearly not true).
            onChange={() => false}
            {...inputProps}
          />
        )}

        {/*
          The custom icon on the right. It is being displayed only if there are
          no errors. For TextBox with error, we display always an alert icon.
        */}
        {errors.length === 0 && props.endIcon && (
          <Icon
            size={iconSize}
            name={props.endIcon}
            className={styles.endIcon}
          />
        )}
        {errors.length > 0 && (
          <Icon
            size={iconSize}
            name='alert'
            color='mid-red'
            className={styles.errorIcon}
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
