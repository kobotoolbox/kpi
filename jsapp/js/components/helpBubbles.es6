import React from 'react';
import autoBind from 'react-autobind';
import bem from '../bem';
import {t} from '../utils';

class HelpBubble extends React.Component {
  constructor(props) {
    super(props);
    autoBind(this);
    this.state = {
      isBubbleVisible: false
    };
  }

  openBubble (evt) {
    console.log('openBubble', evt);
    this.setState({isBubbleVisible: true});
  }

  closeBubble (evt) {
    console.log('closeBubble', evt);
    this.setState({isBubbleVisible: false});
  }

  toggleBubble (evt) {
    console.log('toggleBubble', evt);
    if (this.state.isBubbleVisible) {
      this.closeBubble();
    } else {
      this.openBubble();
    }
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
        className='help-bubble__trigger'
        onClick={this.props.onClick}
        { ...( this.props.tooltipLabel && { 'data-tip': this.props.tooltipLabel } ) }
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

export class IntercomHelpBubble extends HelpBubble {
  constructor(props) {
    super(props);
    autoBind(this);
  }

  render () {
    return (
      <bem.HelpBubble>
        <HelpBubbleTrigger
          icon='intercom'
          onClick={this.toggleBubble.bind(this)}
          tooltipLabel={this.state.isBubbleVisible ? null : t('Intercom')}
        />

        {this.state.isBubbleVisible &&
          <bem.HelpBubble__popup>
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
      <bem.HelpBubble>
        <HelpBubbleTrigger
          icon='help'
          onClick={this.toggleBubble.bind(this)}
          tooltipLabel={this.state.isBubbleVisible ? null : t('Help')}
          counter={this.state.notificationsCount}
        />

        {this.state.isBubbleVisible &&
          <bem.HelpBubble__popup>
            hi!
          </bem.HelpBubble__popup>
        }
      </bem.HelpBubble>
    );
  }
}
