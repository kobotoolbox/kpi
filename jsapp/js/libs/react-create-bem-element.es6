/*
 a simple method to define a hierarchy of bem elements

 A simple way to create a react div using BEM classes:
  <ul className="block">
    <li className="block__element block__element--modifier"></li>
  </ul>

 new way:
  // define the react components in js:
  var Block = React_createBemElement('block', 'ul');
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
import assign from 'react/lib/Object.assign';

var bemClasses = false;
// bemClasses is overridden to {} if a user wants to use a simpler syntax
var React_createBemElement = function(base, el='div'){
  var elUnwrap;
  if (el.match) {
    if (elUnwrap = el.match(/\<(\w+)\s?\/?\>/)) { el = elUnwrap[1]; }
  }

  var reduceModify = function (s, modifier){
    if (Object.prototype.toString.call(modifier) === '[object Object]') {
      Object.keys(modifier).forEach(function(key){
        if (modifier[key]) {
          s[`${base}--${key}`] = true;
        }
      })
    } else if (modifier) {
      s[`${base}--${modifier}`] = true;
    }
    return s
  };

  var c = React.createClass({
    displayName: `BEM.${base}`,
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

      logClassNames.on && logClassNames(`.${props.className.replace(/\s+/,'.')} { }`);
      // passes remaining props to the children
      return React.createElement(el, props);
    }
  })
  c.__createBemChildElement = c.__ = function(addition, el='div') {
    return React_createBemElement(`${base}__${addition}`, el);
  }
  if (bemClasses) {
    bemClasses._klasses[base] = c;
  }

  return c;
}


// BEM.init() and BEM.stop() are optional additoins that let you use an alternative
// syntax where the modules are not built from the parent block's object, but built
// separately
var klasses = {};
React_createBemElement.init = function () {
  bemClasses = function (klsStr, modifiers=false) {
    if (klasses[klsStr]) {
      return klasses[klsStr];
    }
    if (klsStr) {
      klasses[klsStr] = React_createBemElement(klsStr);
      klasses[klsStr].modifiers = modifiers;
      return klasses[klsStr];
    } else if (klsStr === undefined) {
      return klasses;
    }
  };
  bemClasses._klasses = klasses;

  return bemClasses;
}

React_createBemElement.stop = function () {
  bemClasses = false;
  klasses = false;
}

var logClassNames = assign(function(...args){
  if (!logClassNames.on) {
    return false;
  }
  if (!logClassNames.group) {
    console.log(console.group('bem'));
    logClassNames.group = true;
  }
  window.setTimeout((()=>{console.groupEnd('bem'); logClassNames.group=false}), 0)

  logClassNames.on && console.log.apply(console, args);
}, {
  on: false,
  group: false
})

// spits out all the empty CSS rules into the log
React_createBemElement.logClassNames = function(tf){
  // no params turns it on, any falsy param turns it off;
  logClassNames.on = tf === undefined ? true : !!tf;
  return React_createBemElement;
}

export default React_createBemElement;
