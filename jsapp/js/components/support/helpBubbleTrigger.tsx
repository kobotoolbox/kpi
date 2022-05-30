import React from 'react';
import bem from 'js/bem';
import Icon from 'js/components/common/icon';
import type {IconName} from 'jsapp/fonts/k-icons';

interface HelpBubbleTriggerProps {
  icon: IconName;
  counter: number;
  htmlId: string;
  onClick: () => {};
  tooltipLabel: string;
}

export default class HelpBubbleTrigger extends React.Component<HelpBubbleTriggerProps, {}> {
  render() {
    const hasCounter = this.props.counter && this.props.counter !== 0;

    return (
      <bem.HelpBubble__trigger
        onClick={this.props.onClick}
        data-tip={this.props.tooltipLabel}
        id={this.props.htmlId}
      >
        <Icon name={this.props.icon} size='l'/>

        {hasCounter && (
          <bem.HelpBubble__triggerCounter>
            {this.props.counter}
          </bem.HelpBubble__triggerCounter>
        )}
      </bem.HelpBubble__trigger>
    );
  }
}
