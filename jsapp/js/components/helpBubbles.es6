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
    this.cancelOutsideCloseWatch = Function.prototype;
  }

  open (evt) {
    console.log('open', evt);
    this.setState({isOpen: true});
    this.cancelOutsideCloseWatch();
    this.watchOutsideClose();
  }

  close (evt) {
    console.log('close', evt);
    this.setState({isOpen: false});
    this.cancelOutsideCloseWatch();
  }

  toggle (evt) {
    console.log('toggle', evt);
    if (this.state.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  watchOutsideClose() {
    const outsideClickHandler = (evt) => {
      const rootEl = ReactDOM.findDOMNode(this.rootElRef.current);
      if (!rootEl.contains(evt.target)) {
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
