/**
 * A collection of small and generic UI components. The main idea is to not
 * invent a wheel every time, keep things DRY and consistent throughout the app.
 *
 * TODO: would be best to split those to separate files in `jsapp/js/components/generic` directory.
 */

import React from 'react';
import ReactDOM from 'react-dom';
import autoBind from 'react-autobind';
import _ from 'underscore';
import {getAssetDisplayName} from 'js/assetUtils';
import {KEY_CODES} from 'js/constants';
import {bem} from './bem';
import {hasLongWords} from 'utils';
import classNames from 'classnames';

class SearchBox extends React.Component {
  constructor(props) {
    super(props);
    autoBind(this);
  }
  getValue() {
    return ReactDOM.findDOMNode(this.refs.inp).value;
  }
  setValue(v) {
    ReactDOM.findDOMNode(this.refs.inp).value = v;
  }
  render() {
    var elemId = _.uniqueId('elem');
    var value = this.props.value;
    return (
      <input
        type='text'
        ref='inp'
        className='k-search__input'
        value={value}
        onKeyUp={this.props.onKeyUp}
        onChange={this.props.onChange}
        id={elemId}
        placeholder={this.props.placeholder}
        disabled={this.props.disabled}
      />
    );
  }
}

class Panel extends React.Component {
  constructor(props) {
    super(props);
  }
  render () {
    return (
        <bem.uiPanel className={this.props.className} m={this.props.m}>
          <bem.uiPanel__body>
            {this.props.children}
          </bem.uiPanel__body>
        </bem.uiPanel>
      );
  }
};


class Modal extends React.Component {
  constructor (props) {
    super(props);
    autoBind(this);
  }
  componentDidMount() {
    document.addEventListener('keydown', this.escFunction);
  }
  componentWillUnmount() {
    document.removeEventListener('keydown', this.escFunction);
  }
  escFunction (evt) {
    if (evt.keyCode === KEY_CODES.ESC || evt.key === 'Escape') {
      this.props.onClose.call(evt);
    }
  }
  backdropClick (evt) {
    if (evt.currentTarget === evt.target) {
      this.props.onClose.call(evt);
    }
  }
  renderTitle() {
    if (!this.props.title) {
      return null;
    } else if (this.props.small) {
      return (
        <div>
          <bem.Modal__title>{this.props.title}</bem.Modal__title>
          <h6>{this.props.small}</h6>
        </div>
      );
    } else {
      return (
        <bem.Modal__title>{this.props.title}</bem.Modal__title>
      );
    }
  }
  renderClose() {
    if (this.props.isDuplicated) {
      return(
        <a className='modal__done' type='button' onClick={this.props.onClose}>
          {t('DONE')}
        </a>
      );
    } else {
      return(
        <a className='modal__x' type='button' onClick={this.props.onClose}>
          <i className='k-icon k-icon-close'/>
        </a>
      );
    }
  }
  render() {
    return (
      <bem.Modal__backdrop onClick={this.backdropClick}>
        <div className={classNames(
          'modal',
          this.props.className,
          this.props.open ? 'modal--open' : null,
          this.props.large ? 'modal--large' : null,
          this.props.icon ? 'modal--withicon' : null
        )}>
          {this.props.icon &&
            <i className={classNames('modal_icon', `modal_icon--${this.props.icon}`)} />
          }
          <bem.Modal__content>
            <bem.Modal__header>
              {this.renderTitle()}
              {this.renderClose()}
            </bem.Modal__header>
            {this.props.children}
          </bem.Modal__content>
        </div>
      </bem.Modal__backdrop>
    );
  }
};

class Footer extends React.Component {
  constructor(props) {
    super(props);
  }
  render() {
    return (
      <bem.Modal__footer>
        {this.props.children}
      </bem.Modal__footer>
    );
  }
};

Modal.Footer = Footer;

class Body extends React.Component {
  constructor(props) {
    super(props);
  }
  render() {
    return (
      <bem.Modal__body>
        {this.props.children}
      </bem.Modal__body>
    );
  }
};

Modal.Body = Body;

class Tabs extends React.Component {
  constructor(props) {
    super(props);
  }
  render () {
    return <bem.Modal__tabs>{this.props.children}</bem.Modal__tabs>;
  }
};

Modal.Tabs = Tabs;

var BemSidebarAssetName = bem.create('sidebar-asset-name', '<span>');

class SidebarAssetName extends React.Component {
  constructor(props) {
    super(props);
  }
  render () {
    return (
        <BemSidebarAssetName m={{noname: !this.props.name}}>
          {this.props.name || t('No name')}
        </BemSidebarAssetName>
      );
  }
}

class AssetName extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    const displayName = getAssetDisplayName(this.props);
    let extra = null;
    const classNames = ['asset-name'];
    const summary = this.props.summary;

    if (
      !displayName.original &&
      displayName.question &&
      summary.row_count
    ) {
      if (summary.row_count === 2) {
        extra = <small>{t('and one other question')}</small>;
      } else if (summary.row_count > 2) {
        extra = <small>{t('and ## other questions').replace('##', summary.row_count - 1)}</small>;
      }
    }

    if (displayName.empty) {
      // if we display empty name fallback, we style it differently
      classNames.push('asset-name--empty');
    }

    if (hasLongWords(displayName.final)) {
      classNames.push('asset-name--has-long-words');
    }

    return (
      <span className={classNames.join(' ')}>
        {displayName.final} {extra}
      </span>
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
        popoverVisible: false
      });
    }
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
  Modal: Modal,
  SidebarAssetName: SidebarAssetName,
  AssetName: AssetName,
  PopoverMenu: PopoverMenu
};

export default ui;
