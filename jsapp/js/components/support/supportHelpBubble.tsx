import throttle from 'lodash.throttle';
import React from 'react';
import autoBind from 'react-autobind';
import bem from 'js/bem';
import {actions} from 'js/actions';
import envStore from 'js/envStore';
import HelpBubble from './helpBubble';
import HelpBubbleTrigger from './helpBubbleTrigger';

export class SupportHelpBubble extends HelpBubble {
  constructor(props) {
    super(props);
    autoBind(this);
    this.state.selectedMessageUid = null;
    this.state.hasUnacknowledgedMessages = false;
    this.state.messages = [];
    this.bubbleName = 'support-help-bubble';
    this.actionsUnlisteners = [];

    this.refreshMessagesThrottled = throttle(
      actions.help.getInAppMessages,
      60000
    );
  }

  componentWillUnmount() {
    this.actionsUnlisteners.forEach((clb) => {
      clb();
    });
  }

  componentDidMount() {
    this.actionsUnlisteners.push(
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

  onHelpGetInAppMessagesCompleted(response) {
    this.setState({messages: response.results});
    this.checkForUnacknowledgedMessages(response.results);
  }

  onHelpGetInAppMessagesFailed(response) {
    this.setState({messages: []});
    this.checkForUnacknowledgedMessages([]);
  }

  onHelpPatchMessage(message) {
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

  close() {
    super.close();
    this.clearSelectedMessage();
  }

  open() {
    super.open();

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

  onSelectMessage(evt) {
    this.selectMessage(evt.currentTarget.dataset.messageUid);
  }

  onSelectUnacknowledgedListMessage(evt) {
    this.onSelectMessage(evt);
    this.open();
  }

  selectMessage(messageUid) {
    this.setState({selectedMessageUid: messageUid});
    if (!this.isMessageRead(messageUid)) {
      this.markMessageRead(messageUid);
    }
  }

  clearSelectedMessage() {
    this.setState({selectedMessageUid: null});
  }

  findMessage(messageUid) {
    return this.state.messages.find((message) => message.uid === messageUid);
  }

  isMessageRead(messageUid) {
    const msg = this.findMessage(messageUid);
    return !!msg.interactions.readTime && !msg.always_display_as_new;
  }

  markMessageRead(messageUid) {
    const currentTime = new Date();
    actions.help.setMessageReadTime(messageUid, currentTime.toISOString());
  }

  markMessageAcknowledged(evt, messageUid) {
    this.setState({
      locallyAcknowledgedMessageUids: new Set([
        ...this.state.locallyAcknowledgedMessageUids,
        messageUid,
      ]),
    });
    actions.help.setMessageAcknowledged(messageUid, true);
  }

  checkForUnacknowledgedMessages(newMessages) {
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

  renderSnippetRow(msg, clickCallback) {
    const modifiers = ['message', 'message-clickable'];
    if (!msg.interactions.readTime || msg.always_display_as_new) {
      modifiers.push('message-unread');
    }
    return (
      <bem.HelpBubble__row
        m={modifiers}
        key={msg.uid}
        data-message-uid={msg.uid}
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
            return this.renderSnippetRow(msg, this.onSelectMessage.bind(this));
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
                  this.onSelectUnacknowledgedListMessage.bind(this)
                )}
              </bem.HelpBubble__rowWrapper>
            );
          })}
        </bem.HelpBubble__popupContent>
      </bem.HelpBubble__popup>
    );
  }

  renderMessagePopup() {
    const msg = this.findMessage(this.state.selectedMessageUid);

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

  render() {
    let popupRenderFn;
    const modifiers = ['support'];
    if (this.state.isOpen) {
      modifiers.push('open');
      if (this.state.selectedMessageUid) {
        popupRenderFn = this.renderMessagePopup;
        modifiers.push('single-message');
      } else {
        popupRenderFn = this.renderDefaultPopup;
        modifiers.push('list-with-header');
      }
    } else if (this.state.hasUnacknowledgedMessages) {
      popupRenderFn = this.renderUnacknowledgedListPopup;
      modifiers.push('list');
    }

    return (
      <bem.HelpBubble m={modifiers}>
        <HelpBubbleTrigger
          icon='help'
          tooltipLabel={t('Help')}
          onClick={this.toggle.bind(this)}
          counter={this.getUnreadMessagesCount()}
        />

        {popupRenderFn && popupRenderFn()}
      </bem.HelpBubble>
    );
  }
}
