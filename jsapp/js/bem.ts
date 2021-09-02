import React from 'react';
import assign from 'object-assign';

/**
 * USAGE:
 *
 * There are three exports here:
 * - bem - an object that holds all defined components
 * - makeBem - for creating the block component
 */

interface bemInstances {
  [bemName: string]: BemComponentType
}

/**
 * Container for holding all BEM definitions.
 */
const bem: bemInstances = {}

export default bem;

interface BemComponentProps extends React.ComponentProps<any> {
  m?: string | string[]
}

interface BemComponentType extends React.ComponentClass<BemComponentProps, {}> {
  blockName: string
}

/**
 * Creates a BEM class for block or element. Please no angle brackets for `htmlTagName`.
 */
export function makeBem(
  parent: BemComponentType | null,
  name: string,
  htmlTagName: string = 'div'
): BemComponentType {
  class BemComponent extends React.Component<BemComponentProps, {}> {
    static blockName: string = parent ? parent.blockName : name

    constructor(props: BemComponentProps) {
      super(props);
    }

    render() {
      const classNames = [parent ? `${parent.blockName}__${name}` : name];

      if (typeof this.props.m === 'string' && this.props.m.length >= 1) {
        classNames.push(`${name}--${this.props.m}`);
      } else if (Array.isArray(this.props.m)) {
        this.props.m.forEach((modifier) => {
          classNames.push(`${name}--${modifier}`);
        });
      }

      const props = assign({className: classNames.join(' ')}, this.props);

      return React.createElement(htmlTagName, props);
    }
  }

  return BemComponent
}
