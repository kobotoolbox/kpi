import React from 'react';
import bem, {makeBem} from 'js/bem';
import throttle from 'lodash.throttle';
import {KEY_CODES} from 'js/constants';
import {actions} from 'js/actions';
import envStore from 'js/envStore';
import Icon from 'js/components/common/icon';
import './helpBubble.scss';
import type {
  InAppMessage,
  InAppMessagesResponse,
} from 'js/dataInterface';
import helpBubbleStore from './helpBubbleStore';

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
  messages: InAppMessage[];
  selectedMessageUid: string | null;
  isOpen: boolean;
  isOutsideCloseEnabled: boolean;
  hasUnacknowledgedMessages?: boolean;
  locallyAcknowledgedMessageUids: Set<string>;
}

export default class HelpBubble extends React.Component<{}, HelpBubbleState> {
  public bubbleName = '';
  public cancelOutsideCloseWatch = Function.prototype;
  private unlisteners: Function[] = [];
  private refreshMessagesThrottled = throttle(
    actions.help.getInAppMessages,
    60000
  );

  constructor(props: {}) {
    super(props);
    this.state = {
      isOpen: false,
      isOutsideCloseEnabled: true,
      locallyAcknowledgedMessageUids: new Set(),
      selectedMessageUid: null,
      hasUnacknowledgedMessages: false,
      messages: [],
    };

    helpBubbleStore.hi();
  }

  componentDidMount() {
    this.unlisteners.push(
      actions.help.getInAppMessages.completed.listen(
        this.onHelpGetInAppMessagesCompleted.bind(this)
      ),
      actions.help.getInAppMessages.failed.listen(
        this.onHelpGetInAppMessagesFailed.bind(this)
      ),
      actions.help.setMessageReadTime.completed.listen(
        this.onHelpPatchMessage.bind(this)
      ),
      actions.help.setMessageAcknowledged.completed.listen(
        this.onHelpPatchMessage.bind(this)
      )
    );

    actions.help.getInAppMessages();
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => clb());
  }

  onHelpGetInAppMessagesCompleted(response: InAppMessagesResponse) {
    this.setState({messages: response.results});
    this.checkForUnacknowledgedMessages(response.results);
  }

  onHelpGetInAppMessagesFailed() {
    this.setState({messages: []});
    this.checkForUnacknowledgedMessages([]);
  }

  onHelpPatchMessage(message: InAppMessage) {
    const newMessages = this.state.messages;
    for (let i = 0; i < newMessages.length; i++) {
      if (newMessages[i].uid === message.uid) {
        // update patched messages in the list of messages
        newMessages[i] = message;
      }
    }
    this.setState({messages: newMessages});
    this.checkForUnacknowledgedMessages(newMessages);
  }

  open() {
    this.setState({isOpen: true});

    // if enabled we want to close this HelpBubble
    // whenever user clicks outside it or hits ESC key
    this.cancelOutsideCloseWatch();
    if (this.state.isOutsideCloseEnabled) {
      this.watchOutsideClose();
    }

    const unacknowledgedMessages = this.state.messages.filter(
      (msg) =>
        msg.interactions.acknowledged !== true || msg.always_display_as_new
    );
    if (unacknowledgedMessages.length === 1) {
      this.selectMessage(unacknowledgedMessages[0].uid);
    }

    // try getting fresh messages during the lifetime of an app
    this.refreshMessagesThrottled();
  }

  close() {
    this.setState({isOpen: false});
    this.cancelOutsideCloseWatch();
    this.clearSelectedMessage();
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
          $targetEl.parents('.help-bubble__row-wrapper').length === 0
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
    this.selectMessage(messageUid);
  }

  onSelectUnacknowledgedListMessage(messageUid: string) {
    this.selectMessage(messageUid);
    this.open();
  }

  selectMessage(messageUid: string) {
    this.setState({selectedMessageUid: messageUid});
    if (!this.isMessageRead(messageUid)) {
      this.markMessageRead(messageUid);
    }
  }

  clearSelectedMessage() {
    this.setState({selectedMessageUid: null});
  }

  findMessage(messageUid: string) {
    return this.state.messages.find((message) => message.uid === messageUid);
  }

  isMessageRead(messageUid: string) {
    const msg = this.findMessage(messageUid);
    return !!msg?.interactions.readTime && !msg.always_display_as_new;
  }

  markMessageRead(messageUid: string) {
    const currentTime = new Date();
    actions.help.setMessageReadTime(messageUid, currentTime.toISOString());
  }

  markMessageAcknowledged(messageUid: string) {
    this.setState({
      locallyAcknowledgedMessageUids: new Set([
        ...this.state.locallyAcknowledgedMessageUids,
        messageUid,
      ]),
    });
    actions.help.setMessageAcknowledged(messageUid, true);
  }

  checkForUnacknowledgedMessages(newMessages: InAppMessage[]) {
    const unacknowledgedMessages = newMessages.filter(
      (msg) =>
        msg.interactions.acknowledged !== true || msg.always_display_as_new
    );
    this.setState({
      hasUnacknowledgedMessages: unacknowledgedMessages.length >= 1,
      isOutsideCloseEnabled: unacknowledgedMessages.length === 0,
    });
  }

  getUnreadMessagesCount() {
    let count = 0;
    this.state.messages.forEach((msg) => {
      if (!msg.interactions.readTime || msg.always_display_as_new) {
        count++;
      }
    });
    return count;
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
    if (this.state.messages.length > 0) {
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
              <header>{t('KoboToolbox Help Center')}</header>
              <p>
                {t(
                  'A vast collection of user support articles and tutorials related to Kobo'
                )}
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
              <i className='k-icon k-icon-forum' />
              <header>{t('KoboToolbox Community Forum')}</header>
              <p>
                {t(
                  'Post your questions to get answers from experienced Kobo users around the world'
                )}
              </p>
            </bem.HelpBubble__rowAnchor>
          )}

          {this.state.messages.length > 0 && (
            <bem.HelpBubble__row m='header'>
              {t('Notifications')}
            </bem.HelpBubble__row>
          )}

          {this.state.messages.map((msg) => {
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
          {this.state.messages.map((msg) => {
            const locallyAcknowledged =
              this.state.locallyAcknowledgedMessageUids.has(msg.uid);
            if (
              (msg.always_display_as_new && locallyAcknowledged) ||
              (!msg.always_display_as_new && msg.interactions.acknowledged)
            ) {
              return;
            }

            return (
              <bem.HelpBubble__rowWrapper key={msg.uid}>
                <bem.HelpBubble__close onClick={this.markMessageAcknowledged.bind(this, msg.uid)}>
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
    if (this.state.selectedMessageUid === null) {
      return null;
    }

    const msg = this.findMessage(this.state.selectedMessageUid);

    if (msg === undefined) {
      return null;
    }

    return (
      <bem.HelpBubble__popup>
        <bem.HelpBubble__close onClick={this.close.bind(this)}>
          <i className='k-icon k-icon-close' />
        </bem.HelpBubble__close>

        <bem.HelpBubble__back onClick={this.clearSelectedMessage.bind(this)}>
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
    const unreadCount = this.getUnreadMessagesCount();

    return (
      <bem.HelpBubble__trigger
        onClick={this.toggle.bind(this)}
        data-tip={t('Help')}
      >
        <Icon name='help' size='l'/>

        {unreadCount !== 0 && (
          <bem.HelpBubble__triggerCounter>
            {unreadCount}
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
      if (this.state.selectedMessageUid) {
        popupRenderFn = this.renderMessagePopup.bind(this);
        modifiers.push('single-message');
      } else {
        popupRenderFn = this.renderDefaultPopup.bind(this);
        modifiers.push('list-with-header');
      }
    } else if (this.state.hasUnacknowledgedMessages) {
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
