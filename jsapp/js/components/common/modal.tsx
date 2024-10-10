import React from 'react';
import {KEY_CODES} from 'js/constants';
import bem from 'js/bem';
import classNames from 'classnames';
import Button from 'js/components/common/button';
import './modal.scss';

interface ModalPartialProps {
  children?: React.ReactNode;
}

class Footer extends React.Component<ModalPartialProps> {
  render() {
    return (<bem.Modal__footer>{this.props.children}</bem.Modal__footer>);
  }
}

class Body extends React.Component<ModalPartialProps> {
  render() {
    return (<bem.Modal__body>{this.props.children}</bem.Modal__body>);
  }
}

class Tabs extends React.Component<ModalPartialProps> {
  render() {
    return <bem.Modal__tabs>{this.props.children}</bem.Modal__tabs>;
  }
}

interface ModalProps {
  onClose: () => void;
  open: boolean;
  children: React.ReactNode;
  title: string;
  icon?: string;
  small?: boolean;
  large?: boolean;
  isDuplicated?: boolean;
  disableEscClose?: boolean;
  disableBackdropClose?: boolean;
  customModalHeader?: React.ReactNode;
  className?: string;
}

/**
 * A generic modal component.
 *
 * @deprecated Please use `KoboModal`.
 */
export default class Modal extends React.Component<ModalProps> {
  static Footer = Footer;
  static Body = Body;
  static Tabs = Tabs;

  escFunctionBound = this.escFunction.bind(this);

  componentDidMount() {
    document.addEventListener('keydown', this.escFunctionBound);
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.escFunctionBound);
  }

  escFunction(evt: KeyboardEvent) {
    if (!this.props.disableEscClose && (evt.keyCode === KEY_CODES.ESC || evt.key === 'Escape')) {
      this.props.onClose.call(evt);
    }
  }

  backdropClick(evt: TouchEvent) {
    if (evt.currentTarget === evt.target && !this.props.disableBackdropClose) {
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
      return (
        <Button
          type='text'
          size='l'
          label={t('DONE')}
          onClick={this.props.onClose}
        />
      );
    } else {
      return (
        <a className='modal__x' type='button' onClick={this.props.onClose}>
          <i className='k-icon k-icon-close'/>
        </a>
      );
    }
  }

  render() {
    return (
      <bem.Modal__backdrop onClick={this.backdropClick.bind(this)}>
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
