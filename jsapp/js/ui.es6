/**
 * A collection of small and generic UI components. The main idea is to not
 * invent a wheel every time, keep things DRY and consistent throughout the app.
 *
 * TODO: would be best to split those to separate files in `jsapp/js/components/generic` directory.
 */

import React from 'react';
import autoBind from 'react-autobind';
import {bem} from './bem';

class PopoverMenu extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      popoverVisible: false,
      popoverHiding: false,
      placement: 'below'
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
  toggle(evt) {
    var isBlur = evt.type === 'blur';

    if (isBlur && this.props.blurEventDisabled)
      return false;

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
          popoverHiding: true
        });
        // if we setState and immediately hide popover then links will not register as clicked
        window.setTimeout(()=>{
          if (!this._mounted)
            return false;

          this.setState({
            popoverVisible: false,
            popoverHiding: false
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
  componentWillReceiveProps(nextProps) {
    if (this.state.popoverVisible && nextProps.clearPopover) {
      this.setState({
        popoverVisible: false
      });
    }
  }
  render () {
    const mods = this.props.additionalModifiers || [];
    mods.push(this.state.placement);
    if (this.props.type) {
      mods.push(this.props.type);
    }

    return (
      <bem.PopoverMenu m={mods}>
        <bem.PopoverMenu__toggle onClick={this.toggle} onBlur={this.toggle} data-tip={this.props.triggerTip} tabIndex='1' className={this.props.triggerClassName}>
          {this.props.triggerLabel}
        </bem.PopoverMenu__toggle>
        <bem.PopoverMenu__content m={[this.state.popoverHiding ? 'hiding' : '', this.state.popoverVisible ? 'visible' : 'hidden']}>
          {this.props.children}
        </bem.PopoverMenu__content>
      </bem.PopoverMenu>

    );
  }
};



var ui = {
  PopoverMenu: PopoverMenu
};

export default ui;
