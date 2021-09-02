import React from 'react';

/**
 * USAGE:
 *
 * There are two exports here:
 * - bem - an object that holds all defined components (default export)
 * - makeBem - for creating the block or element component
 */

interface bemInstances {
  [bemName: string]: BemInstance
}

/**
 * Container for holding all BEM definitions.
 */
const bem: bemInstances = {}

export default bem;

type BemModifiersObject = {
  [modifierName: string]: boolean
}

interface BemComponentProps extends React.ComponentProps<any> {
  m?: string | string[] | BemModifiersObject
}

interface BemInstance extends React.ComponentClass<BemComponentProps, {}> {
  blockName: string
}

/**
 * Creates a BEM class for block or element.
 * For first parameter pass `null` to create a Block component,
 * or pass existing Block component to create Element component (a child).
 * Please no angle brackets for `htmlTagName`.
 */
export function makeBem(
  parent: BemInstance | null,
  name: string,
  htmlTagName: string = 'div'
): BemInstance {
  class BemComponent extends React.Component<BemComponentProps, {}> {
    static blockName: string = parent ? parent.blockName : name

    constructor(props: BemComponentProps) {
      super(props);
    }

    render() {
      let classNames: string[] = [];

      // Keep existing className attribute if given (either string or array)
      if (typeof this.props.className === 'string') {
        classNames.push(this.props.className);
      } else if (Array.isArray(this.props.className)) {
        classNames.push(this.props.className.join(' '));
      }

      // wholeName includes parent, e.g. `parent-block__child-element`
      const wholeName = parent ? `${parent.blockName}__${name}` : name
      classNames.push(wholeName);

      // modifiers could be a single string or array of strings or object with booleans
      if (typeof this.props.m === 'string' && this.props.m.length >= 1) {
        // Case 1: string
        classNames.push(`${wholeName}--${this.props.m}`);
      } else if (Array.isArray(this.props.m)) {
        // Case 2: array
        this.props.m.forEach((modifier) => {
          if (typeof modifier === 'string' && modifier.length >= 1) {
            classNames.push(`${wholeName}--${modifier}`);
          }
        });
      } else if (typeof this.props.m === 'object') {
        // Case 3: object
        Object.entries(this.props.m).forEach((entry) => {
          if (entry[1] === true) {
            classNames.push(`${wholeName}--${entry[0]}`);
          }
        });
      }

      const newProps: {[propName: string]: any} = {
        className: classNames.join(' ')
      }

      // Keep all the original props expect for modifiers (don't need it) and
      // className (we use our own).
      Object.entries(this.props).forEach((propEntry) => {
        if (propEntry[0] !== 'm' && propEntry[0] !== 'className') {
          newProps[propEntry[0]] = propEntry[1];
        }
      });

      return React.createElement(htmlTagName, newProps);
    }
  }

  return BemComponent
}
