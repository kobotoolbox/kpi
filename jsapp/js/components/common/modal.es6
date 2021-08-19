import React from 'react';
import autoBind from 'react-autobind';
import {KEY_CODES} from 'js/constants';
import bem from 'js/bem';
import classNames from 'classnames';
import './modal.scss';

/**
 * A generic modal component.
 *
 * @prop {function} onClose
 * @prop {string} title
 * @prop {boolean} small
 * @prop {boolean} isDuplicated
 * @prop {string} className
 * @prop {boolean} open
 * @prop {boolean} large
 * @prop {string} icon
 * @prop {node} children
 */
export default class Modal extends React.Component {
  constructor(props) {
    super(props);
    autoBind(this);
  }

  componentDidMount() {
    document.addEventListener('keydown', this.escFunction);
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.escFunction);
  }

  escFunction(evt) {
    if (evt.keyCode === KEY_CODES.ESC || evt.key === 'Escape') {
      this.props.onClose.call(evt);
    }
  }

  backdropClick(evt) {
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
              {!this.props.customModalHeader &&
                this.renderTitle()
              }
              {this.props.customModalHeader}
              {this.renderClose()}
            </bem.Modal__header>
            {this.props.children}
          </bem.Modal__content>
        </div>
      </bem.Modal__backdrop>
    );
  }
}

/**
 * @prop {node} children
 */
class Footer extends React.Component {
  constructor(props) {
    super(props);
  }
  render() {
    return (<bem.Modal__footer>{this.props.children}</bem.Modal__footer>);
  }
}
Modal.Footer = Footer;

/**
 * @prop {node} children
 */
class Body extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    return (<bem.Modal__body>{this.props.children}</bem.Modal__body>);
  }
}
Modal.Body = Body;

/**
 * @prop {node} children
 */
class Tabs extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    return <bem.Modal__tabs>{this.props.children}</bem.Modal__tabs>;
  }
}
Modal.Tabs = Tabs;
