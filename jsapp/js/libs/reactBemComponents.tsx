/*
 a simple method to define a hierarchy of bem elements

 A simple way to create a react div using BEM classes:
  <ul className="block">
    <li className="block__element block__element--modifier"></li>
  </ul>

 new way:
  // define the react components in js:
  const bem = bemComponents({
    Buttons: 'buttons',             // <div> is implied
    Block: ['block', 'ul'],         // Other tags (e.g. <ul>) can be specified
    Block__el: ['block__el', 'li'],
  })

  // use them in jsx:
  <bem.Block>
    <bem.Block__element>
      hello
    </bem.Block__element>
    <bem.Block__element m='modifier'>
      world
    </bem.Block__element>
    <bem.Block__element className='arbitrary-classname'>
      !
    </bem.Block__element>
  </bem.Block>

  // equates to this jsx:

  <ul className="block">
    <li className="block__element">hello</li>
    <li className="block__element block__element--modifier">world</li>
    <li className="block__element arbitrary-classname">!</li>
  </ul>

*/
import React from 'react';
import cx from 'classnames';
import type { Argument as ClassnamesArgument } from 'classnames'

const reactCreateBemElement = function(base: string, el='div'){
  let elUnwrap;
  if (el.match) {
    elUnwrap = el.match(/\<(\w+)\s?\/?\>/);
    if (elUnwrap) {
      el = elUnwrap[1];
    }
  }

  const reduceModify = function (
    s: {[key: string]: boolean},
    modifier:
      {[key: string]: boolean}
      | string[]
      | string
      | undefined
  ){
    if (typeof modifier === 'object' && !Array.isArray(modifier)) {
      Object.keys(modifier).forEach(function(key){
        if (modifier[key]) {
          s[`${base}--${key}`] = true;
        }
      });
    } else if (modifier) {
      s[`${base}--${modifier}`] = true;
    }
    return s;
  };


  class c extends React.Component<{
    m?: string[] | string;
    className: string;
    classNames: ClassnamesArgument;
  }> {
    render() {
      const props = Object.assign({}, this.props);

      // allows modifiers to be a string, an array, or undefined (ignored)
      const modifier = ([] as Array<string | undefined>).concat(props.m)
                      .reduce(reduceModify, {});

      // builds the bem classNames, and allows additional classNames
      // to be specified in an object (props.classNames) or normal string
      const className = cx(base,
                         modifier,
                         props.classNames,
                         props.className);

      // Omitting m and classNames from new Props
      // via "Tricky Destructuring Assignment" (https://stackoverflow.com/a/33053362)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const {m, classNames, ...newProps} = props;
      return React.createElement(el, {...newProps, className});
    }
    static displayName = `BEM.${base}`;
  }

  return c;
};

export function bemComponents (obj: {[key: string]: ([string, string?] | string)}) {
  let keys = Object.keys(obj);
  return Object.freeze(keys.reduce(function(hsh: any, key){
    let val = obj[key];
    if (val instanceof Array) {
      hsh[key] = reactCreateBemElement.apply(null, val);
    } else {
      hsh[key] = reactCreateBemElement(val);
    }
    return hsh;
  }, {}));
}
