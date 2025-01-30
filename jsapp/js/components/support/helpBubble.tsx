import React from 'react';
import bem, {makeBem} from 'js/bem';
import {KEY_CODES} from 'js/constants';
import envStore from 'js/envStore';
import Icon from 'js/components/common/icon';
import './helpBubble.scss';
import type {InAppMessage} from './helpBubbleStore';
import helpBubbleStore from './helpBubbleStore';
import {observer} from 'mobx-react';

bem.HelpBubble = makeBem(null, 'help-bubble');
bem.HelpBubble__close = makeBem(bem.HelpBubble, 'close', 'button');
bem.HelpBubble__back = makeBem(bem.HelpBubble, 'back', 'button');
bem.HelpBubble__trigger = makeBem(bem.HelpBubble, 'trigger', 'button');
bem.HelpBubble__triggerCounter = makeBem(bem.HelpBubble, 'trigger-counter', 'span');
bem.HelpBubble__popup = makeBem(bem.HelpBubble, 'popup');
bem.HelpBubble__popupContent = makeBem(bem.HelpBubble, 'popup-content');
bem.HelpBubble__row = makeBem(bem.HelpBubble, 'row');
bem.HelpBubble__rowAnchor = makeBem(bem.HelpBubble, 'row', 'a');
bem.HelpBubble__rowWrapper = makeBem(bem.HelpBubble, 'row-wrapper');

interface HelpBubbleState {
  isOpen: boolean;
}

class HelpBubble extends React.Component<{}, HelpBubbleState> {
  public cancelOutsideCloseWatch = Function.prototype;
  private store = helpBubbleStore;

  constructor(props: {}) {
    super(props);
    this.state = {
      isOpen: false,
    };
  }

  open() {
    this.setState({isOpen: true});

    // if enabled we want to close this HelpBubble
    // whenever user clicks outside it or hits ESC key
    this.cancelOutsideCloseWatch();
    if (this.store.unacknowledgedMessages.length === 0) {
      this.watchOutsideClose();
    }

    if (this.store.unacknowledgedMessages.length === 1) {
      this.store.selectMessage(this.store.unacknowledgedMessages[0].uid);
    }

    this.store.fetchMessages();
  }

  close() {
    this.setState({isOpen: false});
    this.cancelOutsideCloseWatch();
    this.store.unselectMessage();
  }

  toggle() {
    if (this.state.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  watchOutsideClose() {
    const outsideClickHandler = (evt: MouseEvent) => {
      if (evt.target) {
        const $targetEl = $(evt.target);
        if (
          $targetEl.parents('.help-bubble__back').length === 0 &&
          $targetEl.parents('.help-bubble__popup').length === 0 &&
          $targetEl.parents('.help-bubble__popup-content').length === 0 &&
          $targetEl.parents('.help-bubble__row').length === 0 &&
          $targetEl.parents('.help-bubble__row-wrapper').length === 0 &&
          $targetEl.parents('.help-bubble').length === 0
        ) {
          this.close();
        }
      }
    };

    const escHandler = (evt: KeyboardEvent) => {
      if (evt.keyCode === KEY_CODES.ESC || evt.key === 'Escape') {
        this.close();
      }
    };

    this.cancelOutsideCloseWatch = () => {
      document.removeEventListener('click', outsideClickHandler);
      document.removeEventListener('keydown', escHandler);
    };

    document.addEventListener('click', outsideClickHandler);
    document.addEventListener('keydown', escHandler);
  }

  onSelectMessage(messageUid: string) {
    this.store.selectMessage(messageUid);
  }

  onSelectUnacknowledgedListMessage(messageUid: string) {
    this.store.selectMessage(messageUid);
    this.open();
  }

  renderSnippetRow(msg: InAppMessage, clickCallback: (messageUid: string) => void) {
    const modifiers = ['message', 'message-clickable'];
    if (!msg.interactions.readTime || msg.always_display_as_new) {
      modifiers.push('message-unread');
    }
    return (
      <bem.HelpBubble__row
        m={modifiers}
        key={msg.uid}
        onClick={clickCallback}
      >
        <header>{msg.title}</header>
        <div dangerouslySetInnerHTML={{__html: msg.html.snippet}} />
      </bem.HelpBubble__row>
    );
  }

  renderDefaultPopup() {
    const popupModifiers = [];
    if (this.store.messages.length > 0) {
      popupModifiers.push('has-more-content');
    }

    return (
      <bem.HelpBubble__popup m={popupModifiers}>
        <bem.HelpBubble__close onClick={this.close.bind(this)}>
          <i className='k-icon k-icon-close' />
        </bem.HelpBubble__close>

        <bem.HelpBubble__popupContent>
          <bem.HelpBubble__row m='header'>
            {t('Help Resources')}
          </bem.HelpBubble__row>

          {envStore.isReady && envStore.data.support_url && (
            <bem.HelpBubble__rowAnchor
              m='link'
              target='_blank'
              href={envStore.data.support_url}
              onClick={this.close.bind(this)}
            >
              <i className='k-icon k-icon-help-articles' />
              <header>{t('Help Center')}</header>
              <p>
                {t('Find answers in our extensive library of user support articles and tutorials.')}
              </p>
            </bem.HelpBubble__rowAnchor>
          )}

          {envStore.isReady && envStore.data.community_url && (
            <bem.HelpBubble__rowAnchor
              m='link'
              target='_blank'
              href={envStore.data.community_url}
              onClick={this.close.bind(this)}
            >
              <i className='k-icon k-icon-help-forum' />
              <header>{t('Community Forum')}</header>
              <p>
                {t('Connect with thousands of KoboToolbox users, ask questions, and share ideas.')}
              </p>
            </bem.HelpBubble__rowAnchor>
          )}

          {envStore.isReady && envStore.data.academy_url && (
            <bem.HelpBubble__rowAnchor
              m='link'
              target='_blank'
              href={envStore.data.academy_url}
              onClick={this.close.bind(this)}
            >
              <i className='k-icon k-icon-help-academy' />
              <header>{t('KoboToolbox Academy')}</header>
              <p>
                {t('Enroll in an online self-paced course designed by Kobo staff experts.')}
              </p>
            </bem.HelpBubble__rowAnchor>
          )}

          {this.store.messages.length > 0 && (
            <bem.HelpBubble__row m='header'>
              {t('Notifications')}
            </bem.HelpBubble__row>
          )}

          {this.store.messages.map((msg) => {
            const modifiers = ['message', 'message-clickable'];
            if (!msg.interactions.readTime || msg.always_display_as_new) {
              modifiers.push('message-unread');
            }
            return this.renderSnippetRow(msg, this.onSelectMessage.bind(this, msg.uid));
          })}
        </bem.HelpBubble__popupContent>
      </bem.HelpBubble__popup>
    );
  }

  renderUnacknowledgedListPopup() {
    return (
      <bem.HelpBubble__popup>
        <bem.HelpBubble__popupContent>
          {this.store.messages.map((msg) => {
            const locallyAcknowledged =
              this.store.locallyAcknowledgedMessageUids.has(msg.uid);
            if (
              (msg.always_display_as_new && locallyAcknowledged) ||
              (!msg.always_display_as_new && msg.interactions.acknowledged)
            ) {
              return;
            }

            return (
              <bem.HelpBubble__rowWrapper key={msg.uid}>
                <bem.HelpBubble__close onClick={this.store.markMessageAcknowledged.bind(this.store, msg.uid)}>
                  <i className='k-icon k-icon-close' />
                </bem.HelpBubble__close>

                {this.renderSnippetRow(
                  msg,
                  this.onSelectUnacknowledgedListMessage.bind(this, msg.uid)
                )}
              </bem.HelpBubble__rowWrapper>
            );
          })}
        </bem.HelpBubble__popupContent>
      </bem.HelpBubble__popup>
    );
  }

  renderMessagePopup() {
    if (this.store.selectedMessageUid === null) {
      return null;
    }

    const msg = this.store.findMessage(this.store.selectedMessageUid);

    if (msg === undefined) {
      return null;
    }

    return (
      <bem.HelpBubble__popup>
        <bem.HelpBubble__close onClick={this.close.bind(this)}>
          <i className='k-icon k-icon-close' />
        </bem.HelpBubble__close>

        <bem.HelpBubble__back onClick={this.store.unselectMessage.bind(this.store)}>
          <i className='k-icon k-icon-angle-left' />
        </bem.HelpBubble__back>

        <bem.HelpBubble__popupContent>
          <bem.HelpBubble__row m='message-title'>
            <header>{msg.title}</header>
          </bem.HelpBubble__row>

          <bem.HelpBubble__row
            m='message'
            dangerouslySetInnerHTML={{__html: msg.html.body}}
          />
        </bem.HelpBubble__popupContent>
      </bem.HelpBubble__popup>
    );
  }

  renderTrigger() {
    return (
      <bem.HelpBubble__trigger
        onClick={this.toggle.bind(this)}
        data-tip={t('Help')}
        disabled={this.store.isLoading}
      >
        <Icon name='help' size='l'/>

        {this.store.unreadCount !== 0 && (
          <bem.HelpBubble__triggerCounter>
            {this.store.unreadCount}
          </bem.HelpBubble__triggerCounter>
        )}
      </bem.HelpBubble__trigger>
    );
  }

  render() {
    let popupRenderFn: () => JSX.Element | null = () => null;
    const modifiers = ['support'];
    if (this.state.isOpen) {
      modifiers.push('open');
      if (this.store.selectedMessageUid) {
        popupRenderFn = this.renderMessagePopup.bind(this);
        modifiers.push('single-message');
      } else {
        popupRenderFn = this.renderDefaultPopup.bind(this);
        modifiers.push('list-with-header');
      }
    } else if (this.store.unacknowledgedMessages.length >= 1) {
      popupRenderFn = this.renderUnacknowledgedListPopup.bind(this);
      modifiers.push('list');
    }

    return (
      <bem.HelpBubble m={modifiers}>
        {this.renderTrigger()}

        {popupRenderFn()}
      </bem.HelpBubble>
    );
  }
}

export default observer(HelpBubble);
