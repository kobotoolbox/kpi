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
    this.rootElRef = React.createRef();
    this.cancelOutsideClickListener = Function.prototype;
  }

  open (evt) {
    console.log('open', evt);
    this.setState({isOpen: true});
    this.cancelOutsideClickListener();
    this.listenOutsideClick();
  }

  close (evt) {
    console.log('close', evt);
    this.setState({isOpen: false});
    this.cancelOutsideClickListener();
  }

  toggle (evt) {
    console.log('toggle', evt);
    if (this.state.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  listenOutsideClick() {
    const handler = (evt) => {
      const rootEl = ReactDOM.findDOMNode(this.rootElRef.current);
      if (!rootEl.contains(evt.target)) {
        this.close();
      }
    }

    this.cancelOutsideClickListener = () => {
      document.removeEventListener('click', handler);
    }

    document.addEventListener('click', handler);
  }
}

class HelpBubbleTrigger extends React.Component {
  constructor(props) {
    super(props);
    autoBind(this);
  }

  render () {
    const iconClass = `k-icon k-icon-${this.props.icon}`;

    return (
      <bem.HelpBubble__trigger
        onClick={this.props.parent.toggle.bind(this.props.parent)}
        { ...( !this.props.parent.state.isOpen && { 'data-tip': this.props.tooltipLabel } ) }
      >
        <i className={iconClass}/>

        {this.props.counter &&
          <bem.HelpBubble__triggerCounter>
            {this.props.counter}
          </bem.HelpBubble__triggerCounter>
        }
      </bem.HelpBubble__trigger>
    );
  }
}

class HelpBubbleCloser extends React.Component {
  constructor(props) {
    super(props);
    autoBind(this);
  }

  render () {
    return (
      <bem.HelpBubble__closer onClick={this.props.parent.close.bind(this.props.parent)}>
        <i className='k-icon k-icon-close'/>
      </bem.HelpBubble__closer>
    );
  }
}

export class IntercomHelpBubble extends HelpBubble {
  constructor(props) {
    super(props);
    autoBind(this);
  }

  render () {
    return (
      <bem.HelpBubble ref={this.rootElRef}>
        <HelpBubbleTrigger
          icon='intercom'
          tooltipLabel={t('Intercom')}
          parent={this}
        />

        {this.state.isOpen &&
          <bem.HelpBubble__popup>
            <HelpBubbleCloser parent={this}/>
            hi!
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
      notificationsCount: 1
    }
  }

  render () {
    return (
      <bem.HelpBubble ref={this.rootElRef}>
        <HelpBubbleTrigger
          icon='help'
          parent={this}
          tooltipLabel={t('Help')}
          counter={this.state.notificationsCount}
        />

        {this.state.isOpen &&
          <bem.HelpBubble__popup>
            <HelpBubbleCloser parent={this}/>
            hi!
          </bem.HelpBubble__popup>
        }
      </bem.HelpBubble>
    );
  }
}
