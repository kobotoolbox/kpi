import React from 'react';
import autoBind from 'react-autobind';
import bem from 'js/bem';

/**
 * NOTE: this is depracated, please try not to use it
 *
 * @prop {function} popoverSetVisible
 * @prop {boolean} clearPopover
 * @prop {boolean} blurEventDisabled
 * @prop {string} type
 * @prop {string[]} additionalModifiers
 * @prop {node} triggerLabel - the element that will be opening the menu, menu will be placed in relation to it
 * @prop {node} children - content od the menu, can be anything really
 */
export default class PopoverMenu extends React.Component {
  constructor(props) {
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
  componentWillReceiveProps(nextProps) {
    if (this.state.popoverVisible && nextProps.clearPopover) {
      this.setState({
        popoverVisible: false,
      });
    }
  }

  toggle(evt) {
    var isBlur = evt.type === 'blur';

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
        }, 200);
    } else {
      this.setState({
        popoverVisible: true,
      });
    }

    if (this.props.type === 'assetrow-menu' && !this.state.popoverVisible) {
      // if popover doesn't fit above, place it below
      // 20px is a nice safety margin
      const $assetRow = $(evt.target).parents('.asset-row');
      const $popoverMenu = $(evt.target).parents('.popover-menu').find('.popover-menu__content');
      if ($assetRow.offset().top > $popoverMenu.outerHeight() + $assetRow.outerHeight() + 20) {
        this.setState({placement: 'above'});
      } else {
        this.setState({placement: 'below'});
      }
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
