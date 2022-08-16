import type {ReactElement} from 'react';
import React from 'react';
import type {IconName} from 'jsapp/fonts/k-icons';
import Icon from 'js/components/common/icon';
import './inlineMessage.scss';

export type InlineMessageType = 'default' | 'error' | 'success' | 'warning';

interface InlineMessageProps {
  type: InlineMessageType;
  icon?: IconName;
  message: ReactElement<any, any> | string;
  /** Additional class names. */
  classNames?: string[];
  'data-cy'?: string;
}

/**
 * A button component.
 */
class InlineMessage extends React.Component<InlineMessageProps, {}> {
  render() {
    let classNames: string[] = [];

    // Additional class names.
    if (this.props.classNames) {
      classNames = this.props.classNames;
    }

    // Base class with mandatory ones.
    classNames.push('k-inline-message');
    classNames.push(`k-inline-message--type-${this.props.type}`);

    return (
      <figure className={classNames.join(' ')}>
        {this.props.icon &&
          <Icon name={this.props.icon} size='m'/>
        }

        {this.props.message &&
          <p
            className='k-inline-message__message'
            data-cy={this.props['data-cy']}
          >
            {this.props.message}
          </p>
        }
      </figure>
    );
  }
}

export default InlineMessage;
