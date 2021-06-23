import React from 'react';
import ReactDOM from 'react-dom';
import autoBind from 'react-autobind';
import {bem} from 'js/bem';
import {KEY_CODES} from 'js/constants';

export const KOBO_DROPDOWN_THEMES = {};
new Set([
  'light',
  'dark',
]).forEach((codename) => {KOBO_DROPDOWN_THEMES[codename] = codename;});
Object.freeze(KOBO_DROPDOWN_THEMES);

bem.KoboDropdown = bem.create('kobo-dropdown');
bem.KoboDropdown__trigger = bem.KoboDropdown.__('trigger', 'button');
bem.KoboDropdown__menu = bem.KoboDropdown.__('menu', 'menu');
bem.KoboDropdown__menuButtonRow = bem.KoboDropdown.__('button-row', 'button');

/**
 * A generic dropdown component that accepts any content inside. If you need a
 * selector dropdown, please look at `react-select`.
 *
 * You can use some existing content elements:
 * - bem.KoboDropdown__menuButtonRow
 *
 * @prop {string} [theme] - `light` by default - one of KOBO_DROPDOWN_THEMES
 * @prop {boolean} [isDisabled] `false` by default
 * @prop {boolean} [hideOnMenuClick] `false` by default - hides menu whenever user clicks inside it, useful for simple menu with a list of actions
 * @prop {boolean} [hideOnMenuOutsideClick] `false` by default - hides menu when user clicks outside it
 * @prop {boolean} [hideOnMenuMouseLeave] `false` by default
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
    this.HIDING_DELAY = 300; // ms
    this.hidingTimeoutId = null;
    autoBind(this);
  }

  onTriggerClick(evt) {
    console.log('onTriggerClick', evt);
    this.toggleMenu();
  }

  onMenuClick(evt) {
    console.log('onMenuClick', evt);
    if (this.props.hideOnMenuClick) {
      this.hideMenu();
    }
  }

  toggleMenu() {
    console.log('toggleMenu');
    if (this.state.isMenuVisible) {
      this.hideMenu();
    } else {
      this.showMenu();
    }
  }

  showMenu() {
    console.log('showMenu');
    this.setState({isMenuVisible: true});
    window.addEventListener('click', this.onWindowClick);
    this.cancelDelayedHiding();
    this.registerEscKeyListener();
    this.registerOutsideClickListener();
  }

  hideMenu() {
    console.log('hideMenu');
    this.setState({isMenuVisible: false});
    window.removeEventListener('click', this.onWindowClick);
    this.cancelDelayedHiding();
    this.cancelEscKeyListener();
    this.cancelOutsideClickListener();
  }

  hideMenuWithDelay() {
    console.log('hideMenuWithDelay');
    this.cancelDelayedHiding();
    this.hidingTimeoutId = window.setTimeout(
      this.hideMenu.bind(this),
      this.HIDING_DELAY
    );
  }

  cancelDelayedHiding() {
    console.log('cancelDelayedHiding');
    window.clearTimeout(this.hidingTimeoutId);
    this.hidingTimeoutId = null;
  }

  registerEscKeyListener() {
    console.log('registerEscKeyListener');
    document.addEventListener('keydown', this.onAnyKeyWhileOpen);
  }

  cancelEscKeyListener() {
    console.log('cancelEscKeyListener');
    document.removeEventListener('keydown', this.onAnyKeyWhileOpen);
  }

  onAnyKeyWhileOpen(evt) {
    console.log('onAnyKeyWhileOpen', evt);
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
    console.log('registerOutsideClickListener');
    window.addEventListener('click', this.checkOutsideClick);
    window.addEventListener('touch', this.checkOutsideClick);
    window.addEventListener('touchstart', this.checkOutsideClick);
    window.addEventListener('contextmenu', this.checkOutsideClick);
  }

  cancelOutsideClickListener() {
    console.log('cancelOutsideClickListener');
    window.removeEventListener('click', this.checkOutsideClick);
    window.removeEventListener('touch', this.checkOutsideClick);
    window.removeEventListener('touchstart', this.checkOutsideClick);
    window.removeEventListener('contextmenu', this.checkOutsideClick);
  }

  checkOutsideClick(evt) {
    console.log('checkOutsideClick', evt);
    let isOutsideClick = true;
    const dropdownWrapperEl = ReactDOM.findDOMNode(this);

    // check for older chrome versions
    let loopEl = evt.target;
    // if we go as far as that much of parents up looking for dropdown
    // we assume it is not a dropdown
    let safetyCounter = 5;
    while (loopEl.parentNode !== null) {
      if (--safetyCounter === 0) {break;}
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

  render() {
    const wrapperMods = [];
    if (this.props.theme === KOBO_DROPDOWN_THEMES.dark) {
      wrapperMods.push(KOBO_DROPDOWN_THEMES.dark);
    } else if (
      this.props.theme === KOBO_DROPDOWN_THEMES.light ||
      !this.props.theme
    ) {
      wrapperMods.push(KOBO_DROPDOWN_THEMES.light);
    }

    const triggerMods = [];
    if (this.props.isDisabled) {
      triggerMods.push('disabled');
    }

    return (
      <bem.KoboDropdown m={wrapperMods}>
        <bem.KoboDropdown__trigger
          m={triggerMods}
          onClick={this.onTriggerClick}
        >
          {this.props.triggerContent}
        </bem.KoboDropdown__trigger>

        {this.state.isMenuVisible &&
          <bem.KoboDropdown__menu
            onClick={this.onMenuClick}
          >
            {this.props.menuContent}
          </bem.KoboDropdown__menu>
        }
      </bem.KoboDropdown>
    );
  }
}
