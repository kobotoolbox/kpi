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
import classNames from 'classnames';
import assign from 'object-assign';
import PropTypes from 'prop-types';

const reactCreateBemElement = function(base, el='div'){
  let elUnwrap;
  if (el.match) {
    elUnwrap = el.match(/\<(\w+)\s?\/?\>/);
    if (elUnwrap) {
      el = elUnwrap[1];
    }
  }

  let reduceModify = function (s, modifier){
    if (Object.prototype.toString.call(modifier) === '[object Object]') {
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

  class c extends React.Component {
    render () {
      let props = assign({}, this.props);

      // allows modifiers to be a string, an array, or undefined (ignored)
      let modifier = [].concat(props.m)
                      .reduce(reduceModify, {});
      delete props.m;

      // builds the bem classNames, and allows additional classNames
      // to be specified in an object (props.classNames) or normal string
      props.className = classNames(base,
                                    modifier,
                                    props.classNames,
                                    props.className);
      delete props.classNames;

      return React.createElement(el, props);
    }
  };
  c.propTypes = {
    m: PropTypes.any,
    className: PropTypes.string,
    classNames: PropTypes.any,
  };
  c.displayName = `BEM.${base}`;
  return c;
};

export function bemComponents (obj) {
  let keys = Object.keys(obj);
  return Object.freeze(keys.reduce(function(hsh, key){
    let val = obj[key];
    if (val instanceof Array) {
      hsh[key] = reactCreateBemElement.apply(null, val);
    } else {
      hsh[key] = reactCreateBemElement(val);
    }
    return hsh;
  }, {}));
}
