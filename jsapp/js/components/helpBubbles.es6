import _ from 'underscore';
import React from 'react';
import ReactDOM from 'react-dom';
import autoBind from 'react-autobind';
import bem from '../bem';
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

  isNew(bubbleName) {
    const storageItem = window.localStorage.getItem(bubbleName);
    if (storageItem !== null) {
      return parseInt(storageItem) <= 5;
    } else {
      return true;
    }
  }

  bumpNewCounter(bubbleName) {
    const storageItem = window.localStorage.getItem(bubbleName);
    if (storageItem === null) {
      window.localStorage.setItem(bubbleName, 0);
    } else {
      window.localStorage.setItem(bubbleName, parseInt(storageItem) + 1);
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
      selectedMessageId: null,
      messages: {}
    }
    this.bubbleName = 'support-help-bubble';
  }

  componentDidMount() {
    // mock messages
    this.setState({
      messages: {
        xyz: {
          username: 'Leszek',
          body: 'Haha, fooled you! This is the first message that you ever will',
          readTime: null,
          title: 'Very Important Announcement Title',
          snippet: 'You had better click this!',
          validFrom: '2018-12-01T01:23:45',
          validTo: '2070-12-01T01:23:45',
          linkClickedTime: null,
        },
        abc: {
          username: 'Gniewosz',
          body: 'Haha, fooled you! This is the first message that you ever will',
          readTime: '2019-01-26T01:23:45',
          title: 'Very Important Announcement Title',
          snippet: 'You had better click this!',
          validFrom: '2018-12-01T01:23:45',
          validTo: '2070-12-01T01:23:45',
          linkClickedTime: null,
        },
        foo: {
          username: 'Henryk',
          body: 'Haha, fooled you! This is the first message that you ever will',
          readTime: null,
          title: 'Very Important Announcement Title',
          snippet: 'You had better click this!',
          validFrom: '1995-12-01T01:23:45',
          validTo: '1999-12-01T01:23:45',
          linkClickedTime: 2,
        },
        bar: {
          username: 'Ignacy',
          body: 'Haha, fooled you! This is the first message that you ever will',
          readTime: null,
          title: 'Very Important Announcement Title',
          snippet: 'You had better click this!',
          validFrom: '2020-12-01T01:23:45',
          validTo: '2021-12-01T01:23:45',
          linkClickedTime: null,
        }
      }
    });
  }

  close() {
    super.close();
    this.clearSelectedMessage();
  }

  selectMessage(evt) {
    const messageId = evt.currentTarget.dataset.messageId;
    this.setState({selectedMessageId: messageId});
    this.markMessageRead(messageId);
  }

  clearSelectedMessage() {
    this.setState({selectedMessageId: null});
  }

  getMessage(messageId) {
    return this.state.messages[messageId];
  }

  markMessageRead(messageId) {
    const currentTime = new Date();
    this.state.messages[messageId].readTime = currentTime.toISOString();
    this.setState({messages: this.state.messages});
  }

  getUnreadMessagesCount() {
    let count = 0;
    this.getValidMessageIds().map((messageId) => {
      if (this.state.messages[messageId].readTime === null) {
        count++;
      }
    });
    return count;
  }

  getValidMessageIds() {
    const validMessageIds = [];
    Object.keys(this.state.messages).map((messageId) => {
      const message = this.state.messages[messageId];
      const dateFrom = new Date(message.validFrom);
      const dateTo = new Date(message.validTo);
      const timeNow = Date.now();

      if (
        dateFrom.getTime() <= timeNow &&
        timeNow <= dateTo.getTime()
      ) {
        validMessageIds.push(messageId);
      }
    });
    return validMessageIds;
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

        {this.getValidMessageIds().map((messageId) => {
          const message = this.state.messages[messageId];
          const modifiers = ['message', 'message-clickable'];
          if (message.readTime === null) {
            modifiers.push('message-unread');
          }
          return (
            <bem.HelpBubble__row
              m={modifiers}
              key={messageId}
              data-message-id={messageId}
              onClick={this.selectMessage.bind(this)}
            >
              <bem.HelpBubble__avatar/>
              <span>{message.username}</span>
              <p>{message.snippet}</p>
            </bem.HelpBubble__row>
          )
        })}
      </bem.HelpBubble__popup>
    );
  }

  renderMessagePopup() {
    const msg = this.getMessage(this.state.selectedMessageId);

    return (
      <bem.HelpBubble__popup>
        <HelpBubbleClose onClick={this.close.bind(this)}/>
        <bem.HelpBubble__back onClick={this.clearSelectedMessage.bind(this)}>
          <i className='k-icon k-icon-prev'/>
        </bem.HelpBubble__back>

        <bem.HelpBubble__row m='message'>
          <bem.HelpBubble__avatar/>
          <span>{msg.username}</span>
          <p>{msg.body}</p>
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

        {this.state.isOpen && this.state.selectedMessageId &&
          this.renderMessagePopup()
        }
        {this.state.isOpen && !this.state.selectedMessageId &&
          this.renderDefaultPopup()
        }
      </bem.HelpBubble>
    );
  }
}
