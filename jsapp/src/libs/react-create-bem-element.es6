/*
 a simple method to define a hierarchy of bem elements

 A simple way to create a react div using BEM classes:
  <ul className="block">
    <li className="block__element block__element--modifier"></li>
  </ul>

 new way:
  // define the react components in js:
  var Block = reactCreateBemElement('block', 'ul');
  var Block__element   = Block.__('element', 'li');

  // use them in jsx:
  <Block>
    <Block__element>
      hello
    </Block__element>
    <Block__element m='modifier'>
      world
    </Block__element>
    <Block__element className='arbitrary-classname'>
      !
    </Block__element>
  </Block>

 equates to this jsx:

  <ul className="block">
    <li className="block__element">hello</li>
    <li className="block__element block__element--modifier">world</li>
    <li className="block__element arbitrary-classname">!</li>
  </ul>

*/
import React from 'react';
import classNames from 'classnames';
import assign from 'object-assign';

/* eslint-disable no-console */
var bemClasses = false;
// bemClasses is overridden to {} if a user wants to use a simpler syntax
var reactCreateBemElement = function(base, el='div'){
  var elUnwrap;
  if (el.match) {
    elUnwrap = el.match(/\<(\w+)\s?\/?\>/);
    if (elUnwrap) {
      el = elUnwrap[1];
    }
  }

  var reduceModify = function (s, modifier){
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
      var props = assign({}, this.props);

      // allows modifiers to be a string, an array, or undefined (ignored)
      var modifier = [].concat(this.props.m || this.props.modifier)
                        .reduce(reduceModify, {});
      delete props.m;
      delete props.modifier;

      // builds the bem classNames, and allows additional classNames
      // to be specified in an object (props.classNames) or normal string
      props.className = classNames(base,
                                    modifier,
                                    this.props.classNames,
                                    this.props.className);
      delete props.classNames;

      // logClassNames.on && logClassNames(`.${props.className.replace(/\s+/,'.')} { }`);
      // passes remaining props to the children
      return React.createElement(el, props);
    }
  };
  c.displayName = `BEM.${base}`;
  c.__createBemChildElement = c.__ = function(addition, _el='div') {
    return reactCreateBemElement(`${base}__${addition}`, _el);
  };
  if (bemClasses) {
    bemClasses._klasses[base] = c;
  }

  return c;
};


// BEM.init() and BEM.stop() are optional additoins that let you use an alternative
// syntax where the modules are not built from the parent block's object, but built
// separately
var klasses = {};
reactCreateBemElement.init = function () {
  bemClasses = function (klsStr, modifiers=false) {
    if (klasses[klsStr]) {
      return klasses[klsStr];
    }
    if (klsStr) {
      klasses[klsStr] = reactCreateBemElement(klsStr);
      klasses[klsStr].modifiers = modifiers;
      return klasses[klsStr];
    } else if (klsStr === undefined) {
      return klasses;
    }
  };
  bemClasses._klasses = klasses;

  return bemClasses;
};

reactCreateBemElement.stop = function () {
  bemClasses = false;
  klasses = false;
};

var logClassNames = assign(function(...args){
  if (!logClassNames.on) {
    return false;
  }
  if (!logClassNames.group) {
    console.log(console.group('bem'));
    logClassNames.group = true;
  }
  window.setTimeout((() => {
    console.groupEnd('bem');
    logClassNames.group = false;
  }), 0);

  if (logClassNames.on) { console.log.apply(console, args); }
}, {
  on: false,
  group: false
});

// spits out all the empty CSS rules into the log
reactCreateBemElement.logClassNames = function(tf){
  // no params turns it on, any falsy param turns it off;
  logClassNames.on = tf === undefined ? true : !!tf;
  return reactCreateBemElement;
};

export const BEM = reactCreateBemElement;
