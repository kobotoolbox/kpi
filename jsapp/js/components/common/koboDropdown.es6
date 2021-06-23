import React from 'react';
import ReactDOM from 'react-dom';
import autoBind from 'react-autobind';
import {bem} from 'js/bem';
import {KEY_CODES} from 'js/constants';
import './koboDropdown.scss';

export const KOBO_DROPDOWN_THEMES = {};
new Set([
  'light',
  'dark',
]).forEach((codename) => {KOBO_DROPDOWN_THEMES[codename] = codename;});
Object.freeze(KOBO_DROPDOWN_THEMES);

export const KOBO_DROPDOWN_PLACEMENTS = {};
new Set([
  'up-left',
  'up-center',
  'up-right',
  'down-left',
  'down-center',
  'down-right',
]).forEach((codename) => {KOBO_DROPDOWN_PLACEMENTS[codename] = codename;});
Object.freeze(KOBO_DROPDOWN_PLACEMENTS);

bem.KoboDropdown = bem.create('kobo-dropdown');
bem.KoboDropdown__trigger = bem.KoboDropdown.__('trigger', 'button');
bem.KoboDropdown__menu = bem.KoboDropdown.__('menu', 'menu');
bem.KoboDropdown__menuButton = bem.KoboDropdown.__('menu-button', 'button');

/**
 * A generic dropdown component that accepts any content inside the menu and
 * inside the opener.
 *
 * NOTE: If you need a select-type dropdown, please use `react-select`.
 *
 * You can use some existing content elements:
 * - bem.KoboDropdown__menuButton - a generic dropdown row button
 * - bem.KoboDropdown__triggerButton - a generic dropdown row button
 *
 * @prop {string} [theme] - `light` by default - one of KOBO_DROPDOWN_THEMES
 * @prop {string} [placement] - `down-center` by default - one of KOBO_DROPDOWN_PLACEMENTS
 * @prop {boolean} [isDisabled] `false` by default
 * @prop {boolean} [hideOnMenuClick] `false` by default - hides menu whenever user clicks inside it, useful for simple menu with a list of actions
 * @prop {boolean} [hideOnMenuOutsideClick] `false` by default - hides menu when user clicks outside it
 * @prop {boolean} [hideOnEsc] `false` by default
 * @prop {node} triggerContent
 * @prop {function} menuContent the content of dropdown, anything's allowed
 */
export default class KoboDropdown extends React.Component {
  constructor(props){
    super(props);
    this.state = {
      isMenuVisible: false,
    };
    autoBind(this);
  }

  onTriggerClick(evt) {
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
    window.addEventListener('click', this.onWindowClick);
    this.registerEscKeyListener();
    this.registerOutsideClickListener();
  }

  hideMenu() {
    this.setState({isMenuVisible: false});
    window.removeEventListener('click', this.onWindowClick);
    this.cancelEscKeyListener();
    this.cancelOutsideClickListener();
  }

  registerEscKeyListener() {
    document.addEventListener('keydown', this.onAnyKeyWhileOpen);
  }

  cancelEscKeyListener() {
    document.removeEventListener('keydown', this.onAnyKeyWhileOpen);
  }

  onAnyKeyWhileOpen(evt) {
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

  checkOutsideClick(evt) {
    let isOutsideClick = true;
    const dropdownWrapperEl = ReactDOM.findDOMNode(this);

    let loopEl = evt.target;
    // If we check too much parents going upward looking for dropdown then we
    // assume it is not a dropdown.
    let parentsLookupLimit = 6;
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

    if (
      this.props.theme &&
      typeof KOBO_DROPDOWN_THEMES[this.props.theme] !== 'undefined'
    ) {
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
    return (
      <bem.KoboDropdown m={this.getWrapperModifiers()}>
        <bem.KoboDropdown__trigger onClick={this.onTriggerClick}>
          {this.props.triggerContent}
        </bem.KoboDropdown__trigger>

        {this.state.isMenuVisible &&
          <bem.KoboDropdown__menu onClick={this.onMenuClick}>
            {this.props.menuContent}
          </bem.KoboDropdown__menu>
        }
      </bem.KoboDropdown>
    );
  }
}
