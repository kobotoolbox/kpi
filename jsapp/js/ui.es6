/**
 * A collection of small and generic UI components. The main idea is to not
 * invent a wheel every time, keep things DRY and consistent throughout the app.
 *
 * TODO: would be best to split those to separate files in `jsapp/js/components/generic` directory.
 */

import React from 'react';
import autoBind from 'react-autobind';
import _ from 'underscore';
import {getAssetDisplayName} from 'js/assetUtils';
import {KEY_CODES} from 'js/constants';
import {bem} from './bem';
import {hasLongWords} from 'utils';
import classNames from 'classnames';

/**
 * @prop {string} value
 * @prop {string} placeholder
 * @prop {boolean} disabled
 * @prop {function} onKeyUp
 * @prop {function} onChange
 */
class SearchBox extends React.Component {
  constructor(props) {
    super(props);
    autoBind(this);
  }
  render() {
    return (
      <input
        type='text'
        className='k-search__input'
        value={this.props.value}
        onKeyUp={this.props.onKeyUp}
        onChange={this.props.onChange}
        id={_.uniqueId('elem')}
        placeholder={this.props.placeholder}
        disabled={this.props.disabled}
      />
    );
  }
}

/**
 * @prop {string} className
 * @prop {string} m - uiPanel BEM modifier
 * @prop {node} children
 */
class Panel extends React.Component {
  constructor(props) {
    super(props);
  }
  render() {
    return (
      <bem.uiPanel className={this.props.className} m={this.props.m}>
        <bem.uiPanel__body>
          {this.props.children}
        </bem.uiPanel__body>
      </bem.uiPanel>
    );
  }
}

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

export class AccessDeniedMessage extends React.Component {
  render() {
    return (
      <bem.FormView>
        <bem.Loading>
          <bem.Loading__inner>
            <h3>
              {t('Access Denied')}
            </h3>
            {t('You do not have permission to view this page.')}
          </bem.Loading__inner>
        </bem.Loading>
      </bem.FormView>
    );
  }
}

/**
 * @prop {string} [message] optional message
 */
export class LoadingSpinner extends React.Component {
  render() {
    const message = this.props.message || t('loading…');

    return (
      <bem.Loading>
        <bem.Loading__inner>
          <i className='k-spin k-icon k-icon-spinner'/>
          {message}
        </bem.Loading__inner>
      </bem.Loading>
    );
  }
}

var ui = {
  AccessDeniedMessage,
  LoadingSpinner,
  SearchBox: SearchBox,
  Panel: Panel,
  PopoverMenu: PopoverMenu
};

export default ui;
