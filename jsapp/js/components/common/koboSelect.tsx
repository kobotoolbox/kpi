import React, {ReactElement} from 'react'
import Fuse from 'fuse.js';
import {FUSE_OPTIONS} from 'js/constants';
import bem, {makeBem} from 'js/bem';
import {IconName} from 'jsapp/fonts/k-icons'
import Icon, {IconSize} from 'js/components/common/icon'
import Button, {ButtonSize, ButtonToIconMap} from 'js/components/common/button'
import KoboDropdown, {KoboDropdownPlacements} from 'js/components/common/koboDropdown'
import koboDropdownActions from 'js/components/common/koboDropdownActions'
import './koboSelect.scss'

// We can't use "kobo-select" as it is already being used for custom styling of `react-select`.
bem.KoboSelect = makeBem(null, 'k-select')
bem.KoboSelect__trigger = makeBem(bem.KoboSelect, 'trigger')
bem.KoboSelect__triggerSelectedOption = makeBem(bem.KoboSelect, 'trigger-selected-option', 'span')
bem.KoboSelect__clear = makeBem(bem.KoboSelect, 'clear')
bem.KoboSelect__menu = makeBem(bem.KoboSelect, 'menu', 'menu')
bem.KoboSelect__option = makeBem(bem.KoboSelect, 'option', 'button')
bem.KoboSelect__searchbox = makeBem(bem.KoboSelect, 'searchbox', 'input')

/**
 * KoboSelect types are:
 * 1. blue
 * 2. gray
 * 3. outline - please use `isSearchable` only with this type
 */
export type KoboSelectType = 'blue' | 'gray' | 'outline'

interface KoboSelectOption {
  icon?: IconName
  label: string
  /** Needs to be unique! */
  id: string
}

type KoboSelectProps = {
  /** Unique name. */
  name: string
  type: KoboSelectType
  /**
   * The size is the height of the trigger, but it also influences its paddings.
   * Sizes are generally the same as in button component so we use same type.
   */
  size: ButtonSize
  /** Without this option select always need the `selectedOption`. */
  isClearable?: boolean
  /** This option displays a text box filtering options when opened. */
  isSearchable?: boolean
  isDisabled?: boolean
  /** Changes the appearance to display spinner. */
  isPending?: boolean
  options: KoboSelectOption[]
  /** Pass the id or null for no selection. */
  selectedOption: string | null
  /**
   * Callback function telling which option is selected now. Passes either
   * option id or `null` when cleared.
   */
  onChange: Function
}

type KoboSelectState = {
  /** Used with the `isSearchable` option. */
  filterPhrase: string,
  /** Keeps data from `menuVisibilityChange`. */
  isMenuVisible: boolean
}

/**
 * A select component. Uses `KoboDropdown` as base.
 */
class KoboSelect extends React.Component<KoboSelectProps, KoboSelectState> {
  constructor(props: KoboSelectProps){
    super(props)
    this.state = {
      filterPhrase: '',
      isMenuVisible: false
    }
  }

  private unlisteners: Function[] = []

  componentDidMount() {
    this.unlisteners.push(
      koboDropdownActions.menuVisibilityChange.done.listen(this.onMenuVisibilityChange.bind(this))
    );
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {clb()})
  }

  onMenuVisibilityChange(name: string, isVisible: boolean) {
    console.log('onMenuVisibilityChange', name, isVisible)
    if (name === this.props.name) {
      this.setState({
        isMenuVisible: isVisible,
        filterPhrase: isVisible === false ? '' : this.state.filterPhrase
      })
    }
  }

  /** Please make sure to pass the `selectedOption` prop back here. */
  onOptionClick(newSelectedOption: string) {
    this.props.onChange(newSelectedOption)
  }

  onClear(evt: Event) {
    // We don't want it to trigger opening
    evt.preventDefault()
    evt.stopPropagation()
    koboDropdownActions.hideAnyDropdown()
    this.props.onChange(null)
  }

  setFilterPhrase(newPhrase: string) {
    this.setState({filterPhrase: newPhrase})
  }

  /**
   * Returns the filtered list of options. We butcher the fuse return value a bit
   * as we don't need any of it here.
   */
  getFilteredOptionsList() {
    if (this.state.filterPhrase !== '') {
      let fuse = new Fuse(this.props.options, {...FUSE_OPTIONS, keys: ['id', 'label']});
      const fuseSearch = fuse.search(this.state.filterPhrase);
      return fuseSearch.map((result) => result.item)
    }
    return this.props.options;
  }

  onSearchBoxChange(evt: React.ChangeEvent<HTMLInputElement>) {
    this.setFilterPhrase(evt.target.value)
  }

  onSearchBoxClick(evt: React.ChangeEvent<HTMLInputElement>) {
    // We don't want it to trigger closing.
    evt.preventDefault()
    evt.stopPropagation()
  }

  isSearchboxVisible() {
    return this.props.isSearchable && this.state.isMenuVisible
  }

  renderTrigger() {
    const foundSelectedOption = this.props.options.find((option) => (
      this.props.selectedOption !== null &&
      option.id === this.props.selectedOption
    ))

    // When one of the options is selected, we display it inside the trigger.
    if (foundSelectedOption) {
      return (
        <bem.KoboSelect__trigger>
          <bem.KoboSelect__triggerSelectedOption>
            {foundSelectedOption.icon &&
              <Icon
                name={foundSelectedOption.icon}
                size={ButtonToIconMap.get(this.props.size)}
              />
            }

            <label>{foundSelectedOption.label}</label>
          </bem.KoboSelect__triggerSelectedOption>

          {this.isSearchboxVisible() &&
            this.renderSearchBox()
          }

          {this.props.isClearable &&
            <bem.KoboSelect__clear onClick={this.onClear.bind(this)}>
              <Icon
                name='close'
                size={ButtonToIconMap.get(this.props.size)}
              />
            </bem.KoboSelect__clear>
          }

          {this.props.isPending &&
            <Icon
              name='spinner'
              size={ButtonToIconMap.get(this.props.size)}
              classNames={['k-spin']}
            />
          }

          <Icon name='caret-down' size={ButtonToIconMap.get(this.props.size)}/>
        </bem.KoboSelect__trigger>
      )
    }

    // The default trigger for nothing selected.
    return (
      <bem.KoboSelect__trigger>
        <bem.KoboSelect__triggerSelectedOption>
          <label>{t('Select…')}</label>
        </bem.KoboSelect__triggerSelectedOption>

        {this.isSearchboxVisible() && this.renderSearchBox()}

        <Icon name='caret-down' size={ButtonToIconMap.get(this.props.size)}/>
      </bem.KoboSelect__trigger>
    )
  }

  renderSearchBox() {
    return (
      <bem.KoboSelect__searchbox
        value={this.state.filterPhrase}
        onChange={this.onSearchBoxChange.bind(this)}
        onClick={this.onSearchBoxClick.bind(this)}
      />
    )
  }

  renderMenu() {
    const filteredOptions = this.getFilteredOptionsList()

    return (
      <bem.KoboSelect__menu>
        {filteredOptions.map((option) => (
          <bem.KoboSelect__option
            key={option.id}
            onClick={this.onOptionClick.bind(this, option.id)}
            m={{
              'selected': (
                this.props.selectedOption !== null &&
                this.props.selectedOption === option.id
              )
            }}
          >
            {option.icon && <Icon name={option.icon}/>}
            <label>{option.label}</label>
          </bem.KoboSelect__option>
        ))}
      </bem.KoboSelect__menu>
    )
  }

  render() {
    const modifiers = [
      `size-${this.props.size}`,
      `type-${this.props.type}`
    ];

    if (this.props.isPending) {
      modifiers.push('is-pending')
    }

    if (this.props.isSearchable) {
      modifiers.push('is-searchable')
    }

    if (this.state.isMenuVisible) {
      modifiers.push('is-menu-visible')
    }

    return (
      <bem.KoboSelect m={modifiers}>
        <KoboDropdown
          name={this.props.name}
          placement={KoboDropdownPlacements['down-center']}
          isDisabled={Boolean(this.props.isDisabled)}
          hideOnMenuClick
          triggerContent={this.renderTrigger()}
          menuContent={this.renderMenu()}
        />
      </bem.KoboSelect>
    )
  }
}

export default KoboSelect
