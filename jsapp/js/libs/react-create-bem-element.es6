/*
 a simple method to define a hierarchy of bem elements

 A simple way to create a react div using BEM classes:
  <ul className="block">
    <li className="block__element block__element--modifier"></li>
  </ul>

 new way:

 var Block = React_createBemElement('block', 'ul');
 var Block__element   = Block.__('element', 'li');

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
    <li className="arbitrary-classname block__element">!</li>
  </ul>

*/
import React from 'react';
import classNames from 'classnames';
import assign from 'react/lib/Object.assign';

var React_createBemElement = function(base, el='div'){
  var elUnwrap;
  if (el.match) {
    if (elUnwrap = el.match(/\<(\w+)\s?\/?\>/)) { el = elUnwrap[1]; }
  }

  var reduceModify = function (s, modifier){
    return modifier ? `${s} ${base}--${modifier}` : s;
  };

  var c = React.createClass({
    displayName: `BEM.${base}`,
    render () {
      var props = assign({}, this.props);

      // allows modifiers to be a string, an array, or undefined (ignored)
      var modifier = [].concat(this.props.m || this.props.modifier)
                        .reduce(reduceModify, '');
      delete props.m;
      delete props.modifier;

      // builds the bem classNames, and allows additional classNames
      // to be specified in an object (props.classNames) or normal string
      props.className = classNames(base,
                                    modifier,
                                    this.props.classNames,
                                    this.props.className,
                                    modifier);
      delete props.classNames;

      // passes remaining props to the children
      return React.createElement(el, props);
    }
  })
  c.__createBemChildElement = c.__ = function(addition, el='div') {
    return React_createBemElement(`${base}__${addition}`, el);
  }
  return c;
}

export default React_createBemElement;
