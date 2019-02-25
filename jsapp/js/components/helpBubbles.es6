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

  open (evt) {
    this.setState({isOpen: true});
    this.cancelOutsideCloseWatch();
    this.watchOutsideClose();
  }

  close (evt) {
    this.setState({isOpen: false});
    this.cancelOutsideCloseWatch();
  }

  toggle (evt) {
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
}

class HelpBubbleTrigger extends React.Component {
  constructor(props) {
    super(props);
    autoBind(this);
  }

  render () {
    const iconClass = `k-icon k-icon-${this.props.icon}`;
    const hasCounter = typeof this.props.counter === 'number' && this.props.counter !== 0;

    return (
      <bem.HelpBubble__trigger
        onClick={this.props.parent.toggle.bind(this.props.parent)}
        { ...( !this.props.parent.state.isOpen && { 'data-tip': this.props.tooltipLabel } ) }
      >
        <i className={iconClass}/>

        {hasCounter &&
          <bem.HelpBubble__triggerCounter>
            {this.props.counter}
          </bem.HelpBubble__triggerCounter>
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

  render () {
    return (
      <bem.HelpBubble__close onClick={this.props.parent.close.bind(this.props.parent)}>
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
  }

  render () {
    return (
      <bem.HelpBubble m='intercom'>
        <HelpBubbleTrigger
          icon='intercom'
          tooltipLabel={t('Intercom')}
          parent={this}
        />

        {this.state.isOpen &&
          <bem.HelpBubble__popup>
            <HelpBubbleClose parent={this}/>

            {this.state.hasIntercom &&
              <span>intercom!</span>
            }
            {!this.state.hasIntercom &&
              <bem.HelpBubble__rowAnchor m='link'
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
      messages: [
        {
          id: 'xyz',
          username: 'Leszek',
          excerpt: 'This is the first message that you…',
          body: 'This is the first message that you ever will',
          isRead: false
        }
      ]
    }
  }

  close () {
    super.close();
    this.clearSelectedMessage();
  }

  selectMessage (evt) {
    const messageId = evt.currentTarget.dataset.messageId;
    this.setState({selectedMessageId: messageId});
    this.markMessageRead(messageId);
  }

  clearSelectedMessage () {
    this.setState({selectedMessageId: null});
  }

  getMessage (messageId) {
    return _.find(this.state.messages, (message) => {
      return message.id === messageId;
    });
  }

  markMessageRead (messageId) {
    console.log('markMessageRead', messageId);
    const messageIndex = this.state.messages.map((msg) => {
      return msg.id;
    }).indexOf(messageId);

    if (messageIndex !== -1) {
       this.state.messages[messageIndex].isRead = true;
       this.setState({messages: this.state.messages});
    }
  }

  getUnreadMessagesCount () {
    let count = 0;
    this.state.messages.map((msg) => {
      if (!msg.isRead) {
        count++;
      }
    });
    return count;
  }

  renderDefaultPopup () {
    return (
      <bem.HelpBubble__popup>
        <HelpBubbleClose parent={this}/>

        {this.state.messages.map((message) => {
          return (
            <bem.HelpBubble__row
              m={['message', 'message-clickable']}
              key={message.id}
              data-message-id={message.id}
              onClick={this.selectMessage.bind(this)}
            >
              <bem.HelpBubble__avatar/>
              <span>{message.username}</span>
              <p>{message.excerpt}</p>
            </bem.HelpBubble__row>
          )
        })}

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
      </bem.HelpBubble__popup>
    );
  }

  renderMessagePopup () {
    const msg = this.getMessage(this.state.selectedMessageId);

    return (
      <bem.HelpBubble__popup>
        <HelpBubbleClose parent={this}/>
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

  render () {
    return (
      <bem.HelpBubble m='support'>
        <HelpBubbleTrigger
          icon='help'
          parent={this}
          tooltipLabel={t('Help')}
          counter={this.getUnreadMessagesCount()}
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
