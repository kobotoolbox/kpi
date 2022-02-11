import React from 'react';
import ReactDOM from 'react-dom';
import bem, {makeBem} from 'js/bem';
import {
  KEY_CODES,
} from 'js/constants';
import koboDropdownActions from './koboDropdownActions';
import './koboDropdown.scss';

export enum KoboDropdownThemes {
  light = 'light',
  dark = 'dark',
}

export enum KoboDropdownPlacements {
  'up-left' = 'up-left',
  'up-center' = 'up-center',
  'up-right' = 'up-right',
  'down-left' = 'down-left',
  'down-center' = 'down-center',
  'down-right' = 'down-right',
}

type KoboDropdownProps = {
  theme: KoboDropdownThemes,
  placement: KoboDropdownPlacements,
  /** disables the dropdowns trigger, thus disallowing opening dropdown */
  isDisabled: boolean,
  /** hides menu whenever user clicks inside it, useful for simple menu with a list of actions */
  hideOnMenuClick: boolean,
  triggerContent: React.ReactNode,
  /** the content of dropdown, anything's allowed */
  menuContent: React.ReactNode,
  /** optional name value useful for styling, ends up in `data-name` attribute */
  name?: string,
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

  private checkOutsideClickBound = this.checkOutsideClick.bind(this)

  private onAnyKeyWhileOpenBound = this.onAnyKeyWhileOpen.bind(this)

  private unlisteners: Function[] = []

  componentDidMount() {
    this.unlisteners.push(
      koboDropdownActions.hideAnyDropdown.requested.listen(this.hideMenu.bind(this))
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
    // Hides menu when user clicks outside it.
    this.registerEscKeyListener();
    // Hides menu when opened and user uses Escape key.
    this.registerOutsideClickListener();
  }

  hideMenu() {
    this.setState({isMenuVisible: false});
    this.cancelEscKeyListener();
    this.cancelOutsideClickListener();
  }

  registerEscKeyListener() {
    document.addEventListener('keydown', this.onAnyKeyWhileOpenBound);
  }

  cancelEscKeyListener() {
    document.removeEventListener('keydown', this.onAnyKeyWhileOpenBound);
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
    window.addEventListener('click', this.checkOutsideClickBound);
    window.addEventListener('touch', this.checkOutsideClickBound);
    window.addEventListener('touchstart', this.checkOutsideClickBound);
    window.addEventListener('contextmenu', this.checkOutsideClickBound);
  }

  cancelOutsideClickListener() {
    window.removeEventListener('click', this.checkOutsideClickBound);
    window.removeEventListener('touch', this.checkOutsideClickBound);
    window.removeEventListener('touchstart', this.checkOutsideClickBound);
    window.removeEventListener('contextmenu', this.checkOutsideClickBound);
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
      wrapperMods.push(KoboDropdownThemes.light);
    }

    if (
      this.props.placement &&
      typeof KoboDropdownPlacements[this.props.placement] !== 'undefined'
    ) {
      wrapperMods.push(this.props.placement);
    } else {
      wrapperMods.push(KoboDropdownPlacements['down-center']);
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
