import React from 'react';
// Using this type ensures we only have existing icon names
import type {IconName} from 'jsapp/fonts/k-icons';
import './icon.scss';

/**
 * Check out `icon.scss` file for exact pixel values.
 */
export type IconSize = 'l' | 'm' | 's' | 'xl' | 'xs' | 'xxs';
export type IconColor = 'red' | 'storm' | 'teal';

const DefaultSize = 's';

interface IconProps {
  name: IconName;
  size?: IconSize;
  classNames?: string[];
  /**
   * Useful if you need some color for the icon, and the color doesn't come from
   * parent component (e.g. Button).
   */
  color?: IconColor;
}

/**
 * An icon component.
 */
class Icon extends React.Component<IconProps, {}> {
  render() {
    let classNames: string[] = [];
    if (
      Array.isArray(this.props.classNames) &&
      typeof this.props.classNames[0] === 'string'
    ) {
      classNames = this.props.classNames;
    }

    const size = this.props.size || DefaultSize;
    classNames.push(`k-icon--size-${size}`);

    if (this.props.color) {
      classNames.push(`k-icon--color-${this.props.color}`);
    }

    classNames.push('k-icon');
    classNames.push(`k-icon-${this.props.name}`);

    return <i className={classNames.join(' ')} />;
  }
}

export default Icon;
