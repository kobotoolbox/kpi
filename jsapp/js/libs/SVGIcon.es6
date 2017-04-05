// Generate a SVG use:xlink tag using our icon sprites
import React from 'react';
var svgSprite = require('../../img/icons-sprite.svg');

var SVGIcon = React.createClass({
  render () {
    var svgPath = svgSprite.replace(/^.*\/\/[^\/]+/, ''); 
    var useTag = '<use xlink:href="' + svgPath + '#'+ this.props.id + '" />';
    var svgClasses = 'ki-icon ' + this.props.id;
    return (<svg dangerouslySetInnerHTML={{__html: useTag }} className={svgClasses} />);
  },
});

export default SVGIcon;
