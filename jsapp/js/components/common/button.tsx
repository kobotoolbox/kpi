import React from 'react';
import type {IconName} from 'jsapp/fonts/k-icons';
import type {IconSize} from 'js/components/common/icon';
import Icon from 'js/components/common/icon';
import './button.scss';

/**
 * Note: we use a simple TypeScript types here instead of enums, so we don't
 * need to import them, just pass correct strings.
 */

/**
 * Button types are:
 * 1. bare - no border, no background, hover sets background
 * 2. frame - border, no background, hover sets background
 * 3. full - no border, background, hover dims background
 */
export type ButtonType = 'bare' | 'frame' | 'full';
export type ButtonColor = 'blue' | 'light-blue' | 'red' | 'storm';
/**
 * The size is the height of the button, but it also influences the paddings.
 * Check out `button.scss` file for exact pixel values.
 */
export type ButtonSize = 'l' | 'm' | 's';

/** To be used for buttons with both icon and text. */
export const ButtonToIconMap: Map<ButtonSize, IconSize> = new Map();
ButtonToIconMap.set('s', 'xs');
ButtonToIconMap.set('m', 's');
ButtonToIconMap.set('l', 'm');

/** To be used for icon-only buttons. */
const ButtonToIconAloneMap: Map<ButtonSize, IconSize> = new Map();
ButtonToIconAloneMap.set('s', 'm');
ButtonToIconAloneMap.set('m', 'l');
ButtonToIconAloneMap.set('l', 'l');

interface ButtonProps {
  type: ButtonType;
  color: ButtonColor;
  /** Note: this size will also be carried over to the icon. */
  size: ButtonSize;
  /**
   * Setting this displays an icon - either before or after label. Please use
   * only one of the icons.
   */
  startIcon?: IconName;
  endIcon?: IconName;
  /** Label is optional, as sometimes we want an icon-only button. */
  label?: React.ReactNode;
  /**
   * Setting this will make a tooltip appear when hovering over button. Useful
   * for icon-only buttons.
   */
  tooltip?: string;
  isDisabled?: boolean;
  /** Changes the appearance to display spinner. */
  isPending?: boolean;
  /** Sets the button HTML type to "submit". */
  isSubmit?: boolean;
  /** Simply changes the width. */
  isFullWidth?: boolean;
  /** Additional class names. */
  classNames?: string[];
  onClick: (event: any) => void;
  'data-cy'?: string;
}

interface AdditionalButtonAttributes {
  'data-tip'?: string;
  'data-cy'?: string;
}

/**
 * A button component.
 */
const Button = (props: ButtonProps) => {
  // Note: both icon(s) and label are optional, but in reality the button
  // needs at least one of them to work.
  if (!props.startIcon && !props.endIcon && !props.label) {
    throw new Error('Button is missing a required properties: icon or label!');
  }

  let classNames: string[] = [];

  // Additional class names.
  if (props.classNames) {
    classNames = props.classNames;
  }

  // Base class with mandatory ones.
  classNames.push('k-button');
  classNames.push(`k-button--type-${props.type}`);
  classNames.push(`k-button--color-${props.color}`);

  if (props.isPending) {
    classNames.push('k-button--pending');
  }

  if (props.startIcon) {
    classNames.push('k-button--has-start-icon');
  }

  // Ensures only one icon is being displayed.
  if (!props.startIcon && props.endIcon) {
    classNames.push('k-button--has-end-icon');
  }

  if (props.label) {
    classNames.push('k-button--has-label');
  }

  if (props.isFullWidth) {
    classNames.push('k-button--full-width');
  }

  const size = props.size;
  classNames.push(`k-button--size-${size}`);

  // Size depends on label being there or not
  let iconSize = ButtonToIconAloneMap.get(size);
  if (props.label) {
    iconSize = ButtonToIconMap.get(size);
  }

  // For the attributes that don't have a falsy value.
  const additionalButtonAttributes: AdditionalButtonAttributes = {};
  if (props.tooltip) {
    additionalButtonAttributes['data-tip'] = props.tooltip;
  }
  if (props['data-cy']) {
    additionalButtonAttributes['data-cy'] = props['data-cy'];
  }

  return (
    <button
      className={classNames.join(' ')}
      type={props.isSubmit ? 'submit' : 'button'}
      disabled={props.isDisabled}
      onClick={props.onClick}
      {...additionalButtonAttributes}
    >
      {props.startIcon && <Icon name={props.startIcon} size={iconSize} />}

      {props.label && <span className='k-button__label'>{props.label}</span>}

      {/* Ensures only one icon is being displayed.*/}
      {!props.startIcon && props.endIcon && (
        <Icon name={props.endIcon} size={iconSize} />
      )}

      {props.isPending && (
        <Icon name='spinner' size={iconSize} classNames={['k-spin']} />
      )}
    </button>
  );
};

export default Button;
