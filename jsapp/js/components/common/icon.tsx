import React from 'react';
// Using this type ensures we only have existing icon names
import type {IconName} from 'jsapp/fonts/k-icons';
import './icon.scss';

/**
 * Check out `icon.scss` file for exact pixel values.
 */
export type IconSize = 'l' | 'm' | 's' | 'xl' | 'xs' | 'xxs';

const DefaultSize = 's';
const DefaultColor = 'inherit';

interface IconProps {
  name: IconName;
  size?: IconSize;
  classNames?: string[];
  color?: string;
}

/**
 * An icon component.
 */
class Icon extends React.Component<IconProps, {}> {
  constructor(props: IconProps) {
    super(props);
  }

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

    const color = this.props.color || DefaultColor;
    classNames.push(`k-icon--color-${color}`);

    classNames.push('k-icon');
    classNames.push(`k-icon-${this.props.name}`);

    return <i className={classNames.join(' ')} style={{color: `${color}`}} />;
  }
}

export default Icon;
