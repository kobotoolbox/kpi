import React from 'react';
import ReactDOM from 'react-dom';
import bem, {makeBem} from 'js/bem';
import {
  KEY_CODES,
} from 'js/constants';
import koboDropdownActions from './koboDropdownActions';
import './koboDropdown.scss';

export enum KOBO_DROPDOWN_THEMES {
  light = 'light',
  dark = 'dark',
}

export enum KOBO_DROPDOWN_PLACEMENTS {
  'up-left' = 'up-left',
  'up-center' = 'up-center',
  'up-right' = 'up-right',
  'down-left' = 'down-left',
  'down-center' = 'down-center',
  'down-right' = 'down-right',
}

type KoboDropdownThemesType = 'light' | 'dark'

type KoboDropdownPlacementsType =
  'up-left' |
  'up-center' |
  'up-right' |
  'down-left' |
  'down-center' |
  'down-right'


type KoboDropdownProps = {
  theme: KoboDropdownThemesType,
  placement: KoboDropdownPlacementsType,
  isDisabled: boolean, // disables the dropdowns trigger, thus disallowing opening dropdown
  hideOnMenuClick: boolean, // hides menu whenever user clicks inside it, useful for simple menu with a list of actions
  hideOnMenuOutsideClick: boolean, // hides menu when user clicks outside it
  hideOnEsc: boolean, // hides menu when opened and user uses Escape key
  triggerContent: React.ReactNode,
  menuContent: React.ReactNode, // the content of dropdown, anything's allowed
  name?: string, // optional name value useful for styling, ends up in `data-name` attribute
}

type KoboDropdownState = {
  isMenuVisible: boolean,
}

bem.KoboDropdown = makeBem(null, 'kobo-dropdown');
bem.KoboDropdown__trigger = makeBem(bem.KoboDropdown, 'trigger', 'button');
bem.KoboDropdown__menu = makeBem(bem.KoboDropdown, 'menu', 'menu');
bem.KoboDropdown__menuButton = makeBem(bem.KoboDropdown, 'menu-button', 'button');

/**
 * A generic dropdown component that accepts any content inside the menu and
 * inside the trigger.
 *
 * NOTE: If you need a select-type dropdown, please use `react-select`.
 *
 * You can use some existing content elements:
 * - bem.KoboDropdown__menuButton - a generic dropdown row button
 *
 * To close dropdown from outside the component use:
 * - koboDropdownActions.hideAnyDropdown
 */
export default class KoboDropdown extends React.Component<
  KoboDropdownProps,
  KoboDropdownState
> {
  constructor(props: KoboDropdownProps) {
    super(props);
    this.state = {isMenuVisible: false};
  }

  private unlisteners: Function[] = []

  componentDidMount() {
    this.unlisteners.push(
      koboDropdownActions.hideAnyDropdown.requested.listen(this.hideMenu)
    );
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {clb();});
    this.cancelEscKeyListener();
    this.cancelOutsideClickListener();
  }

  onTriggerClick(evt: React.ChangeEvent<HTMLInputElement> | any) {
    evt.preventDefault();
    this.toggleMenu();
  }

  onMenuClick() {
    if (this.props.hideOnMenuClick) {
      this.hideMenu();
    }
  }

  toggleMenu() {
    if (this.state.isMenuVisible) {
      this.hideMenu();
    } else {
      this.showMenu();
    }
  }

  showMenu() {
    this.setState({isMenuVisible: true});
    if (this.props.hideOnEsc) {
      this.registerEscKeyListener();
    }
    if (this.props.hideOnMenuOutsideClick) {
      this.registerOutsideClickListener();
    }
  }

  hideMenu() {
    this.setState({isMenuVisible: false});
    this.cancelEscKeyListener();
    this.cancelOutsideClickListener();
  }

  registerEscKeyListener() {
    document.addEventListener('keydown', this.onAnyKeyWhileOpen);
  }

  cancelEscKeyListener() {
    document.removeEventListener('keydown', this.onAnyKeyWhileOpen);
  }

  onAnyKeyWhileOpen(evt: React.ChangeEvent<HTMLInputElement> | any) {
    if (
      evt.key === 'Escape' ||
      evt.code === 'Escape' ||
      evt.keyCode === KEY_CODES.ESC ||
      evt.which === KEY_CODES.ESC
    ) {
      this.hideMenu();
    }
  }

  registerOutsideClickListener() {
    window.addEventListener('click', this.checkOutsideClick);
    window.addEventListener('touch', this.checkOutsideClick);
    window.addEventListener('touchstart', this.checkOutsideClick);
    window.addEventListener('contextmenu', this.checkOutsideClick);
  }

  cancelOutsideClickListener() {
    window.removeEventListener('click', this.checkOutsideClick);
    window.removeEventListener('touch', this.checkOutsideClick);
    window.removeEventListener('touchstart', this.checkOutsideClick);
    window.removeEventListener('contextmenu', this.checkOutsideClick);
  }

  checkOutsideClick(evt: React.ChangeEvent<HTMLInputElement> | any) {
    let isOutsideClick = true;
    const dropdownWrapperEl = ReactDOM.findDOMNode(this);

    let loopEl = evt.target;
    // If we check too much parents going upward looking for dropdown then we
    // assume it is not a dropdown.
    let parentsLookupLimit = 10;
    while (loopEl.parentNode !== null) {
      if (--parentsLookupLimit === 0) {break;}
      loopEl = loopEl.parentNode;
      if (
        loopEl &&
        typeof loopEl.isEqualNode === 'function' &&
        loopEl.isEqualNode(dropdownWrapperEl)
      ) {
        isOutsideClick = false;
        break;
      }
    }

    if (isOutsideClick) {
      this.hideMenu();
    }
  }

  getWrapperModifiers() {
    const wrapperMods = [];

    if (this.props.theme) {
      wrapperMods.push(this.props.theme);
    } else {
      wrapperMods.push(KOBO_DROPDOWN_THEMES.light);
    }

    if (
      this.props.placement &&
      typeof KOBO_DROPDOWN_PLACEMENTS[this.props.placement] !== 'undefined'
    ) {
      wrapperMods.push(this.props.placement);
    } else {
      wrapperMods.push(KOBO_DROPDOWN_PLACEMENTS['down-center']);
    }

    // These modifiers are for styling purposes only, i.e. they don't have
    // anything to do with menu being visible.
    if (this.state.isMenuVisible) {
      wrapperMods.push('menu-visible');
    } else {
      wrapperMods.push('menu-hidden');
    }

    if (this.props.isDisabled) {
      wrapperMods.push('disabled');
    }

    return wrapperMods;
  }

  render() {
    const additionalWrapperAttributes = {'data-name': ''}

    if (this.props.name) {
      // We use `data-name` attribute to allow any character in the name.
      additionalWrapperAttributes['data-name'] = this.props.name;
    }

    return (
      <bem.KoboDropdown m={this.getWrapperModifiers()} {...additionalWrapperAttributes}>
        <bem.KoboDropdown__trigger onClick={this.onTriggerClick.bind(this)}>
          {this.props.triggerContent}
        </bem.KoboDropdown__trigger>

        {this.state.isMenuVisible &&
          <bem.KoboDropdown__menu onClick={this.onMenuClick.bind(this)}>
            {this.props.menuContent}
          </bem.KoboDropdown__menu>
        }
      </bem.KoboDropdown>
    );
  }
}
