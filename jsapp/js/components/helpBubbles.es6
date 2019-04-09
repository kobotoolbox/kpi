import _ from 'underscore';
import React from 'react';
import ReactDOM from 'react-dom';
import autoBind from 'react-autobind';
import bem from '../bem';
import actions from '../actions';
import stores from '../stores';
import {t} from '../utils';

class HelpBubble extends React.Component {
  constructor(props) {
    super(props);
    autoBind(this);
    this.state = {
      isOpen: false
    };
    this.cancelOutsideCloseWatch = Function.prototype;
  }

  open(evt) {
    this.setState({isOpen: true});
    this.cancelOutsideCloseWatch();
    this.watchOutsideClose();

    if (this.bubbleName) {
      this.bumpNewCounter(this.bubbleName);
    }
  }

  close(evt) {
    this.setState({isOpen: false});
    this.cancelOutsideCloseWatch();
  }

  toggle(evt) {
    if (this.state.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  watchOutsideClose() {
    const outsideClickHandler = (evt) => {
      const $targetEl = $(evt.target);
      if (
        $targetEl.parents('.help-bubble__popup').length === 0 &&
        $targetEl.parents('.help-bubble__row').length === 0
      ) {
        this.close();
      }
    }

    const escHandler = (evt) => {
      if (evt.keyCode === 27 || evt.key === 'Escape') {
        this.close();
      }
    }

    this.cancelOutsideCloseWatch = () => {
      document.removeEventListener('click', outsideClickHandler);
      document.removeEventListener('keydown', escHandler);
    }

    document.addEventListener('click', outsideClickHandler);
    document.addEventListener('keydown', escHandler);
  }

  getStorageName(bubbleName) {
    const currentUsername = stores.session.currentAccount && stores.session.currentAccount.username;
    return `kobo.${currentUsername}.${bubbleName}`;
  }

  isNew(bubbleName) {
    const storageName = this.getStorageName(bubbleName);
    const storageItem = window.localStorage.getItem(storageName);
    if (storageItem !== null) {
      return parseInt(storageItem) <= 5;
    } else {
      return true;
    }
  }

  bumpNewCounter(bubbleName) {
    const storageName = this.getStorageName(bubbleName);
    const storageItem = window.localStorage.getItem(storageName);
    if (storageItem === null) {
      window.localStorage.setItem(storageName, 0);
    } else {
      window.localStorage.setItem(storageName, parseInt(storageItem) + 1);
    }
  }
}

class HelpBubbleTrigger extends React.Component {
  constructor(props) {
    super(props);
    autoBind(this);
  }

  render() {
    const iconClass = `k-icon k-icon-${this.props.icon}`;
    const hasCounter = typeof this.props.counter === 'number' && this.props.counter !== 0;

    return (
      <bem.HelpBubble__trigger
        onClick={this.props.onClick}
        data-tip={this.props.tooltipLabel}
      >
        <i className={iconClass}/>

        {hasCounter &&
          <bem.HelpBubble__triggerCounter>
            {this.props.counter}
          </bem.HelpBubble__triggerCounter>
        }

        {this.props.isNew &&
          <bem.HelpBubble__triggerBadge>
            {t('new')}
          </bem.HelpBubble__triggerBadge>
        }
      </bem.HelpBubble__trigger>
    );
  }
}

class HelpBubbleClose extends React.Component {
  constructor(props) {
    super(props);
    autoBind(this);
  }

  render() {
    return (
      <bem.HelpBubble__close onClick={this.props.onClick}>
        <i className='k-icon k-icon-close'/>
      </bem.HelpBubble__close>
    );
  }
}

export class IntercomHelpBubble extends HelpBubble {
  constructor(props) {
    super(props);
    autoBind(this);
    this.state = {
      hasIntercom: false
    }
    this.bubbleName = 'intercom-help-bubble';
  }

  render() {
    const attrs = {};
    if (this.isNew(this.bubbleName)) {
      attrs.isNew = true;
    }

    const modifiers = ['intercom'];
    if (this.state.isOpen) {
      modifiers.push('open');
    }

    return (
      <bem.HelpBubble m={modifiers}>
        <HelpBubbleTrigger
          icon='intercom'
          tooltipLabel={t('Intercom')}
          onClick={this.toggle.bind(this)}
          {...attrs}
        />

        {this.state.isOpen &&
          <bem.HelpBubble__popup>
            <HelpBubbleClose onClick={this.close.bind(this)}/>

            {this.state.hasIntercom &&
              <span>intercom!</span>
            }
            {!this.state.hasIntercom &&
              <bem.HelpBubble__rowAnchor
                m='link'
                target='_blank'
                href='https://test.test'
              >
                <header>{t('Chat Support Unavailable')}</header>
                <p>{t('You need to ABC to get XYZ')}</p>
              </bem.HelpBubble__rowAnchor>
            }
          </bem.HelpBubble__popup>
        }
      </bem.HelpBubble>
    );
  }
}

export class SupportHelpBubble extends HelpBubble {
  constructor(props) {
    super(props);
    autoBind(this);
    this.state = {
      selectedMessageUid: null,
      messages: []
    }
    this.bubbleName = 'support-help-bubble';
    this.unlisteners = [];
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {clb();});
  }

  componentDidMount() {
    this.unlisteners.push(
      actions.help.getInAppMessages.completed.listen(this.onHelpGetInAppMessagesCompleted.bind(this)),
      actions.help.getInAppMessages.failed.listen(this.onHelpGetInAppMessagesFailed.bind(this)),
      actions.help.setMessageReadTime.completed.listen(this.onHelpPatchMessage.bind(this)),
      actions.help.setMessageAcknowledged.completed.listen(this.onHelpPatchMessage.bind(this))
    );

    actions.help.getInAppMessages();
  }

  onHelpGetInAppMessagesCompleted(response) {
    console.log('onHelpGetInAppMessagesCompleted', response);
    this.setState({messages: response.results});
  }

  onHelpGetInAppMessagesFailed(response) {
    console.log('onHelpGetInAppMessagesFailed', response);
    this.setState({messages: []});
  }

  onHelpPatchMessage(message) {
    console.log('onHelpPatchMessage', message);
    const messages = this.state.messages;
    for (let i = 0; i < messages.length; i++) {
      if (messages[i].uid === message.uid) {
        messages[i] = message;
      }
    }
    this.setState({messages: messages});
  }

  close() {
    super.close();
    this.clearSelectedMessage();
  }

  selectMessage(evt) {
    const messageUid = evt.currentTarget.dataset.messageUid;
    this.setState({selectedMessageUid: messageUid});
    if (!this.isMessageRead(messageUid)) {
      this.markMessageRead(messageUid);
    }
  }

  clearSelectedMessage() {
    this.setState({selectedMessageUid: null});
  }

  findMessage(messageUid) {
    return _.find(this.state.messages, {uid: messageUid});
  }

  isMessageRead(messageUid) {
    const msg = this.findMessage(messageUid);
    return !!msg.interactions.readTime;
  }

  markMessageRead(messageUid) {
    const currentTime = new Date();
    actions.help.setMessageReadTime(messageUid, currentTime.toISOString())
  }

  markMessageAcknowledged(messageUid) {
    actions.help.setMessageAcknowledged(messageUid, true)
  }

  getUnreadMessagesCount() {
    let count = 0;
    this.state.messages.map((msg) => {
      if (!msg.interactions.readTime) {
        count++;
      }
    });
    return count;
  }

  renderDefaultPopup() {
    return (
      <bem.HelpBubble__popup>
        <HelpBubbleClose onClick={this.close.bind(this)}/>

        <bem.HelpBubble__row m='header'>
          <header>{t('Looking for help?')}</header>
          <p><em>{t('Try visiting one of our online support resources')}</em></p>
        </bem.HelpBubble__row>

        <bem.HelpBubble__rowAnchor
          m='link'
          target='_blank'
          href='https://test.test'
          onClick={this.close.bind(this)}
        >
          <i className='k-icon k-icon-help-articles'/>
          <header>{t('KoBoToolbox Help Center')}</header>
          <p>{t('A vast collection of user support articles and tutorials related to KoBo')}</p>
        </bem.HelpBubble__rowAnchor>

        <bem.HelpBubble__rowAnchor
          m='link'
          target='_blank'
          href='https://test.test'
          onClick={this.close.bind(this)}
        >
          <i className='k-icon k-icon-forum'/>
          <header>{t('KoBoToolbox Community Forum')}</header>
          <p>{t('Post your questions to get answers from experienced KoBo users around the world')}</p>
        </bem.HelpBubble__rowAnchor>

        {this.state.messages.map((msg) => {
          const modifiers = ['message', 'message-clickable'];
          if (!msg.interactions.readTime) {
            modifiers.push('message-unread');
          }
          return (
            <bem.HelpBubble__row
              m={modifiers}
              key={msg.uid}
              data-message-uid={msg.uid}
              onClick={this.selectMessage.bind(this)}
            >
              <span>{msg.title}</span>
              <p dangerouslySetInnerHTML={{__html: msg.html.snippet}}/>
            </bem.HelpBubble__row>
          )
        })}
      </bem.HelpBubble__popup>
    );
  }

  renderMessagePopup() {
    const msg = this.findMessage(this.state.selectedMessageUid);

    return (
      <bem.HelpBubble__popup>
        <HelpBubbleClose onClick={this.close.bind(this)}/>
        <bem.HelpBubble__back onClick={this.clearSelectedMessage.bind(this)}>
          <i className='k-icon k-icon-prev'/>
        </bem.HelpBubble__back>

        <bem.HelpBubble__row m={['message', 'message-with-back-button']}>
          <span>{msg.title}</span>
          <p dangerouslySetInnerHTML={{__html: msg.html.body}}/>
        </bem.HelpBubble__row>
      </bem.HelpBubble__popup>
    );
  }

  render() {
    const attrs = {};
    if (this.isNew(this.bubbleName)) {
      attrs.isNew = true;
    }

    const modifiers = ['support'];
    if (this.state.isOpen) {
      modifiers.push('open');
    }

    return (
      <bem.HelpBubble m={modifiers}>
        <HelpBubbleTrigger
          icon='help'
          tooltipLabel={t('Help')}
          onClick={this.toggle.bind(this)}
          counter={this.getUnreadMessagesCount()}
          {...attrs}
        />

        {this.state.isOpen && this.state.selectedMessageUid &&
          this.renderMessagePopup()
        }
        {this.state.isOpen && !this.state.selectedMessageUid &&
          this.renderDefaultPopup()
        }
      </bem.HelpBubble>
    );
  }
}
