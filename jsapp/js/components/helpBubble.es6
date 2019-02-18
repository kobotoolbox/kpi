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

  toggleBubble (evt) {
    console.log('toggleBubble', evt);
    this.setState({isBubbleVisible: !this.state.isBubbleVisible});
  }

  render () {
    const iconClass = `k-icon k-icon-${this.props.iconName}`;

    return (
      <bem.HelpBubble>
        <bem.HelpBubble__trigger
          className='help-bubble__trigger'
          onClick={this.toggleBubble}
          data-tip={this.props.iconTip}
        >
          <i className={iconClass}/>
        </bem.HelpBubble__trigger>

        {this.state.isBubbleVisible &&
          <bem.HelpBubble__bubble>
            hi!
          </bem.HelpBubble__bubble>
        }
      </bem.HelpBubble>
    );
  }
}

export default HelpBubble;
