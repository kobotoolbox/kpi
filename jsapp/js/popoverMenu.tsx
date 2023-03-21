/**
 * NOTE: this is depracated, please try not to use it
 */

import React from 'react';
import autoBind from 'react-autobind';
import bem from 'js/bem';

interface PopoverMenuProps {
  /** A callback run whenever popover is opened (made visible). */
  popoverSetVisible?: () => void;
  /**
   * This is some weird mechanism for closing the popover from outside. You have
   * to pass a `true` value here, and the code observes property changes, and
   * would close popover :ironically_impressed_nod:.
   */
  clearPopover?: boolean;
  blurEventDisabled?: boolean;
  type?: string;
  additionalModifiers?: string[];
  /** the element that will be opening the menu, menu will be placed in relation to it */
  triggerLabel: React.ReactNode;
  /** content of the menu, can be anything really */
  children?: React.ReactNode;
}

interface PopoverMenuState {
  popoverVisible: boolean;
  popoverHiding: boolean;
  placement: string;
}

type HTMLElementEvent<T extends HTMLElement> = Event & {
  target: T;
  relatedTarget: T;
};

export default class PopoverMenu extends React.Component<
  PopoverMenuProps,
  PopoverMenuState
> {
  _mounted: boolean;

  constructor(props: PopoverMenuProps) {
    super(props);
    this.state = {
      popoverVisible: false,
      popoverHiding: false,
      placement: 'below',
    };
    this._mounted = false;
    autoBind(this);
  }

  componentDidMount() {
    this._mounted = true;
  }

  componentWillUnmount() {
    this._mounted = false;
  }
  // BUG: we should use `getDerivedStateFromProps` instead of depracated
  // `componentWillReceiveProps` but due to unnecessarily complex way of
  // operation of PopoverMenu, using this will cause some instances to open
  // only once.
  // static getDerivedStateFromProps(props, state) {
  //   if (state.popoverVisible && props.clearPopover) {
  //     return {popoverVisible: false};
  //   }
  //   return null;
  // }
  componentWillReceiveProps(nextProps: PopoverMenuProps) {
    if (this.state.popoverVisible && nextProps.clearPopover) {
      this.setState({
        popoverVisible: false,
      });
    }
  }

  toggle(evt: HTMLElementEvent<HTMLButtonElement>): boolean | void {
    const isBlur = evt.type === 'blur';

    if (isBlur && this.props.blurEventDisabled) {
      return false;
    }

    if (
      isBlur &&
      evt.relatedTarget &&
      evt.relatedTarget.dataset &&
      evt.relatedTarget.dataset.popoverMenuStopBlur
    ) {
      // bring back focus to trigger to still enable this toggle callback
      // but don't close the menu
      evt.target.focus();
      return false;
    }

    if (this.state.popoverVisible || isBlur) {
        this.setState({
          popoverHiding: true,
        });
        // if we setState and immediately hide popover then links will not register as clicked
        window.setTimeout(() => {
          if (!this._mounted) {
            return false;
          }

          this.setState({
            popoverVisible: false,
            popoverHiding: false,
          });
          return true;
        }, 200);
    } else {
      this.setState({
        popoverVisible: true,
      });
    }

    if (typeof this.props.popoverSetVisible === 'function' && !this.state.popoverVisible) {
      this.props.popoverSetVisible();
    }
  }

  render() {
    const wrapperMods = this.props.additionalModifiers || [];
    wrapperMods.push(this.state.placement);
    if (this.props.type) {
      wrapperMods.push(this.props.type);
    }

    const menuMods = [];
    if (this.state.popoverHiding) {
      menuMods.push('hiding');
    }
    if (this.state.popoverVisible) {
      menuMods.push('visible');
    } else {
      menuMods.push('hidden');
    }

    return (
      <bem.PopoverMenu m={wrapperMods}>
        <bem.PopoverMenu__toggle
          onClick={this.toggle}
          onBlur={this.toggle}
          tabIndex='1'
        >
          {this.props.triggerLabel}
        </bem.PopoverMenu__toggle>

        <bem.PopoverMenu__content m={menuMods}>
          {this.props.children}
        </bem.PopoverMenu__content>
      </bem.PopoverMenu>

    );
  }
}
