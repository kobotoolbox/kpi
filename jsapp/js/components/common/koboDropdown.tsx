import React from 'react';
import ReactDOM from 'react-dom';
import bem, {makeBem} from 'js/bem';
import {KEY_CODES, KeyNames} from 'js/constants';
import koboDropdownActions from './koboDropdownActions';
import './koboDropdown.scss';

export type KoboDropdownPlacement =
  | 'down-center'
  | 'down-left'
  | 'down-right'
  | 'up-center'
  | 'up-left'
  | 'up-right';

const DEFAULT_PLACEMENT: KoboDropdownPlacement = 'down-center';

interface KoboDropdownProps {
  /** Defaults to DEFAULT_PLACEMENT :wink: */
  placement?: KoboDropdownPlacement;
  isRequired?: boolean;
  /** Disables the dropdowns trigger, thus disallowing opening dropdown. */
  isDisabled?: boolean;
  /** Hides menu whenever user clicks inside it, useful for simple menu with a list of actions. */
  hideOnMenuClick: boolean;
  triggerContent: React.ReactNode;
  /** The content of dropdown, anything's allowed. */
  menuContent: React.ReactNode;
  /**
   * Name useful for styling and `menuVisibilityChange` action, it ends up in
   * the `data-name` attribute.
   */
  name: string;
  'data-cy'?: string;
  /** Alternative way of getting the opened status of the menu. */
  onMenuVisibilityChange?: (isOpened: boolean) => void;
  /** Additional class names. */
  className?: string;
}

interface KoboDropdownState {
  isMenuVisible: boolean;
}

interface AdditionalWrapperAttributes {
  'data-name': string;
  'data-cy'?: string;
}

bem.KoboDropdown = makeBem(null, 'kobo-dropdown');
// NOTE: we can't use `button` element here, as sometimes (see `koboSelect.tsx`)
// we want to have an `input` inside the trigger, and then pressing "spacebar"
// caused the `onTriggerClick` to be fired while simply typing inside the input.
bem.KoboDropdown__trigger = makeBem(bem.KoboDropdown, 'trigger');
bem.KoboDropdown__menu = makeBem(bem.KoboDropdown, 'menu', 'menu');

/**
 * A generic dropdown component that accepts any content inside the menu and
 * inside the trigger.
 *
 * Most cases are handled by `KoboSelect` component that is built atop this one.
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

  private checkOutsideClickBound: (evt: MouseEvent | TouchEvent) => void =
    this.checkOutsideClick.bind(this);

  private onAnyKeyWhileOpenBound: (evt: KeyboardEvent) => void =
    this.onAnyKeyWhileOpen.bind(this);

  private unlisteners: Function[] = [];

  componentDidMount() {
    this.unlisteners.push(
      koboDropdownActions.hideAnyDropdown.requested.listen(
        this.hideMenu.bind(this)
      )
    );
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {
      clb();
    });
    this.cancelEscKeyListener();
    this.cancelOutsideClickListener();
  }

  onTriggerClick(evt: React.KeyboardEvent<Node>) {
    evt.preventDefault();
    this.toggleMenu();
  }

  /** When trigger is focused, this handles the keyboard navigation */
  onTriggerKeyDown(evt: React.KeyboardEvent<Node>) {
    if (
      evt.key === KeyNames.Enter ||
      (evt.key === KeyNames.Space && !this.state.isMenuVisible)
    ) {
      evt.preventDefault();
      this.toggleMenu();
    }
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
    koboDropdownActions.menuVisibilityChange(this.props.name, true);
    if (this.props.onMenuVisibilityChange) {
      this.props.onMenuVisibilityChange(true);
    }
    // Hides menu when user clicks outside it.
    this.registerEscKeyListener();
    // Hides menu when opened and user uses Escape key.
    this.registerOutsideClickListener();
  }

  hideMenu() {
    this.setState({isMenuVisible: false});
    koboDropdownActions.menuVisibilityChange(this.props.name, false);
    if (this.props.onMenuVisibilityChange) {
      this.props.onMenuVisibilityChange(false);
    }
    this.cancelEscKeyListener();
    this.cancelOutsideClickListener();
  }

  registerEscKeyListener() {
    document.addEventListener('keydown', this.onAnyKeyWhileOpenBound);
  }

  cancelEscKeyListener() {
    document.removeEventListener('keydown', this.onAnyKeyWhileOpenBound);
  }

  onAnyKeyWhileOpen(evt: KeyboardEvent) {
    if (
      evt.key === 'Escape' ||
      evt.keyCode === 1 ||
      evt.which === KEY_CODES.ESC
    ) {
      this.hideMenu();
    }
  }

  registerOutsideClickListener() {
    window.addEventListener('click', this.checkOutsideClickBound);
    window.addEventListener('touchstart', this.checkOutsideClickBound);
    window.addEventListener('contextmenu', this.checkOutsideClickBound);
  }

  cancelOutsideClickListener() {
    window.removeEventListener('click', this.checkOutsideClickBound);
    window.removeEventListener('touchstart', this.checkOutsideClickBound);
    window.removeEventListener('contextmenu', this.checkOutsideClickBound);
  }

  checkOutsideClick(evt: MouseEvent | TouchEvent) {
    let isOutsideClick = true;
    const dropdownWrapperEl = ReactDOM.findDOMNode(this);

    let loopEl = evt.target as Node;
    // If we check too much parents going upward looking for dropdown then we
    // assume it is not a dropdown.
    let parentsLookupLimit = 10;
    while (loopEl.parentNode !== null) {
      if (--parentsLookupLimit === 0) {
        break;
      }
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

    if (this.props.placement) {
      wrapperMods.push(this.props.placement);
    } else {
      wrapperMods.push(DEFAULT_PLACEMENT);
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
    const additionalWrapperAttributes: AdditionalWrapperAttributes = {
      // We use `data-name` attribute to allow any character in the name.
      ['data-name']: this.props.name,
    };

    if (this.props['data-cy']) {
      additionalWrapperAttributes['data-cy'] = this.props['data-cy'];
    }

    return (
      <bem.KoboDropdown
        m={this.getWrapperModifiers()}
        {...additionalWrapperAttributes}
        role='combobox'
        aria-required={this.props.isRequired}
        className={this.props.className}
      >
        <bem.KoboDropdown__trigger
          onClick={this.onTriggerClick.bind(this)}
          tabIndex='0'
          onKeyDown={this.onTriggerKeyDown.bind(this)}
        >
          {this.props.triggerContent}
        </bem.KoboDropdown__trigger>

        {this.state.isMenuVisible && (
          <bem.KoboDropdown__menu
            onClick={this.onMenuClick.bind(this)}
            role='listbox'
          >
            {this.props.menuContent}
          </bem.KoboDropdown__menu>
        )}
      </bem.KoboDropdown>
    );
  }
}
