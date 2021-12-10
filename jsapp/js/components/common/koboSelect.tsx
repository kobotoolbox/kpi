import React, {ReactElement} from 'react'
import bem, {makeBem} from 'js/bem';
import {IconName} from 'jsapp/fonts/k-icons'
import Icon, {IconSize} from 'js/components/common/icon'
import Button, {ButtonSize, ButtonToIconMap} from 'js/components/common/button'
import KoboDropdown, {KoboDropdownPlacements} from 'js/components/common/koboDropdown'
import './koboSelect.scss'

// We can't use "kobo-select" as it is already being used for custom styling of `react-select`.
bem.KoboSelect = makeBem(null, 'k-select')
bem.KoboSelect__trigger = makeBem(bem.KoboSelect, 'trigger', 'button')
bem.KoboSelect__menu = makeBem(bem.KoboSelect, 'menu', 'menu')
bem.KoboSelect__option = makeBem(bem.KoboSelect, 'option', 'button')

/**
 * Note: we use a simple TypeScript types here instead of enums, so we don't
 * need to import them, just pass correct strings.
 */

/**
 * KoboSelect types are:
 * 1. blue
 * 2. gray
 * 3. outline - please use `isSearchable` only with this type
 */
export type KoboSelectType = 'blue' | 'gray' | 'outline'

/**
 * The size is the height of the trigger, but it also influences its paddings.
 * Sizes are generally the same as in button component so we use same type.
 */
const DefaultSize: ButtonSize = 'm'

interface KoboSelectOption {
  icon?: IconName
  label: string
  /** Needs to be unique! */
  id: string
}

type KoboSelectProps = {
  type: KoboSelectType
  /** Note: this size will also be carried over to the icon. */
  size: ButtonSize
  /** Without this option select always need the `selectedOption`. */
  isClearable?: boolean
  /** This option displays a text box filtering options when opened. */
  isSearchable?: boolean
  isDisabled?: boolean
  /** Changes the appearance to display spinner. */
  isPending?: boolean
  /** Simply changes the width. */
  isFullWidth?: boolean
  options: KoboSelectOption[]
  /** Pass the id or null for no selection. */
  selectedOption: string | null
  /**
   * Callback function telling which option is selected now. Passes either
   * option id or `null` when cleared.
   */
  onChange: Function
}

/**
 * A select component. Uses `KoboDropdown` as base.
 */
class KoboSelect extends React.Component<KoboSelectProps, {}> {
  constructor(props: KoboSelectProps){
    super(props)
  }

  renderTrigger() {
    return 'trigger'
  }

  renderMenu() {
    return 'menu'
  }

  render() {
    return (
      <KoboDropdown
        placement={KoboDropdownPlacements['down-center']}
        isDisabled={Boolean(this.props.isDisabled)}
        hideOnMenuClick
        triggerContent={this.renderTrigger()}
        menuContent={this.renderMenu()}
      />
    )
  }
}

export default KoboSelect
