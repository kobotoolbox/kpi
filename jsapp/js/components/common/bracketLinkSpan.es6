import React from 'react';
import {escape, isArray} from 'lodash';
import {replaceBracketsWithLink} from 'utils';

// Takes string content with a [bracketed link] and returns a react
// component with an HTML link.
// This allows us to isolate use of `dangerouslySetInnerHTML`

export const BracketLinkSpan = ({children, url}) => {
  if (isArray(children)) {
    children = children[0];
    console.error('BracketLinkSpan should be called with just a string');
  }

  let string = escape(children);
  const __html = replaceBracketsWithLink(string, url);

  return (
    <span dangerouslySetInnerHTML={{__html}} />
  );
};
