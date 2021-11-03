import React from 'react'
import {IconName} from 'jsapp/fonts/k-icons'
import Icon from 'js/components/common/icon'
import './button.scss'

/**
 * Button types are:
 * 1. bare - no border, no background, hover sets background
 * 2. frame - border, no background, hover sets background
 * 3. full - no border, background, hover dims background
 */
export type ButtonType = 'bare' | 'frame' | 'full'
export type ButtonColor = 'blue' | 'teal' | 'green' | 'red' | 'orange' | 'gray'
/**
 * The size is the height of the button, but it also influences the paddings.
 * Check out `button.scss` file for exact pixel values.
 */
export type ButtonSize = 's' | 'm' | 'l'
const DefaultSize = 's'

type ButtonProps = {
  type: ButtonType
  color: ButtonColor
  /** Note: this size will also be carried over to the icon. */
  size?: ButtonSize
  /**
   * Setting this displays an icon - either before or after label. Please use
   * only one of the icons.
   */
  startIcon?: IconName
  endIcon?: IconName
  /** Label is optional, as sometimes we want an icon-only button. */
  label?: string | Node
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
    if (
      Array.isArray(this.props.classNames) &&
      typeof this.props.classNames[0] === 'string'
    ) {
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

    if (this.props.endIcon) {
      classNames.push('k-button--has-end-icon')
    }

    if (this.props.label) {
      classNames.push('k-button--has-label')
    }

    // Optional size, with fallback to DefaultSize.
    let size = this.props.size || DefaultSize
    classNames.push(`k-button--size-${size}`)

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
          <Icon name={this.props.startIcon} size={size}/>
        }

        {this.props.label &&
          <label className='k-button__label'>{this.props.label}</label>
        }

        {this.props.endIcon &&
          <Icon name={this.props.endIcon} size={size}/>
        }

        {this.props.isPending &&
          <Icon name='spinner' size={size} classNames={['k-spin']}/>
        }
      </button>
    )
  }
}

export default Button
