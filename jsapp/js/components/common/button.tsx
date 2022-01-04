import React, {ReactElement} from 'react'
import {IconName} from 'jsapp/fonts/k-icons'
import Icon, {IconSize} from 'js/components/common/icon'
import './button.scss'

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
export type ButtonType = 'bare' | 'frame' | 'full'
export type ButtonColor = 'blue' | 'red' | 'storm'
/**
 * The size is the height of the button, but it also influences the paddings.
 * Check out `button.scss` file for exact pixel values.
 */
export type ButtonSize = 's' | 'm' | 'l'
const DefaultSize = 'm'

/** To be used for buttons with both icon and text. */
const ButtonToIconMap: Map<ButtonSize, IconSize> = new Map()
ButtonToIconMap.set('s', 'xs')
ButtonToIconMap.set('m', 's')
ButtonToIconMap.set('l', 'm')

/** To be used for icon-only buttons. */
const ButtonToIconAloneMap: Map<ButtonSize, IconSize> = new Map()
ButtonToIconAloneMap.set('s', 'm')
ButtonToIconAloneMap.set('m', 'l')
ButtonToIconAloneMap.set('l', 'l')

type ButtonProps = {
  type: ButtonType
  color: ButtonColor
  /** Note: this size will also be carried over to the icon. */
  size: ButtonSize
  /**
   * Setting this displays an icon - either before or after label. Please use
   * only one of the icons.
   */
  startIcon?: IconName
  endIcon?: IconName
  /** Label is optional, as sometimes we want an icon-only button. */
  label?: string | ReactElement<any, any>
  /**
   * Setting this will make a tooltip appear when hovering over button. Useful
   * for icon-only buttons.
   */
  tooltip?: string
  isDisabled?: boolean
  /** Changes the appearance to display spinner. */
  isPending?: boolean
  /** Sets the button HTML type to "submit". */
  isSubmit?: boolean
  /** Simply changes the width. */
  isFullWidth?: boolean
  /** Additional class names. */
  classNames?: string[]
  onClick: Function
}

interface AdditionalButtonAttributes {
  'data-tip'?: string
}

/**
 * A button component.
 */
class Button extends React.Component<ButtonProps, {}> {
  constructor(props: ButtonProps){
    super(props)
  }

  render() {
    // Note: both icon(s) and label are optional, but in reality the button
    // needs at least one of them to work.
    if (
      !this.props.startIcon &&
      !this.props.endIcon &&
      !this.props.label
    ) {
      throw new Error(t('Button is missing a required properties: icon or label!'))
    }

    let classNames: string[] = []

    // Additional class names.
    if (this.props.classNames) {
      classNames = this.props.classNames
    }

    // Base class with mandatory ones.
    classNames.push('k-button')
    classNames.push(`k-button--type-${this.props.type}`)
    classNames.push(`k-button--color-${this.props.color}`)

    if (this.props.isPending) {
      classNames.push('k-button--pending')
    }

    if (this.props.startIcon) {
      classNames.push('k-button--has-start-icon')
    }

    // Ensures only one icon is being displayed.
    if (!this.props.startIcon && this.props.endIcon) {
      classNames.push('k-button--has-end-icon')
    }

    if (this.props.label) {
      classNames.push('k-button--has-label')
    }

    if (this.props.isFullWidth) {
      classNames.push('k-button--full-width')
    }

    // Optional size, with fallback to DefaultSize.
    let size = this.props.size || DefaultSize
    classNames.push(`k-button--size-${size}`)

    // Size depends on label being there or not
    let iconSize = ButtonToIconAloneMap.get(size)
    if (this.props.label) {
      iconSize = ButtonToIconMap.get(size)
    }

    // For the attributes that don't have a falsy value.
    const additionalButtonAttributes: AdditionalButtonAttributes = {}
    if (this.props.tooltip) {
      additionalButtonAttributes['data-tip'] = this.props.tooltip
    }

    return (
      <button
        className={classNames.join(' ')}
        type={this.props.isSubmit ? 'submit' : 'button'}
        disabled={this.props.isDisabled}
        onClick={this.props.onClick.bind(this)}
        {...additionalButtonAttributes}
      >
        {this.props.startIcon &&
          <Icon name={this.props.startIcon} size={iconSize}/>
        }

        {this.props.label &&
          <label className='k-button__label'>{this.props.label}</label>
        }

        {/* Ensures only one icon is being displayed.*/}
        {!this.props.startIcon && this.props.endIcon &&
          <Icon name={this.props.endIcon} size={iconSize}/>
        }

        {this.props.isPending &&
          <Icon name='spinner' size={iconSize } classNames={['k-spin']}/>
        }
      </button>
    )
  }
}

export default Button
