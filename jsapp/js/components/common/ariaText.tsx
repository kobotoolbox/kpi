import React from 'react';

interface AriaTextProps {
  uiText: string;
  screenReaderText: string;
  classNames?: string;
}

/*
 Use this if you're using punctuation or glyphs to convey something that won't make sense to a screen reader
 Example: '12 - 14' gets rendered by a screenreader as 'twelve dash fourteen' instead of 'twelve to fourteen'
 - avoid trailing/leading spaces in uiText and screenReaderText
 - *don't* use if uiText and screenReaderText have the same text or convey very different information
*/
const AriaText = (props: AriaTextProps) => (
  <>
    <span aria-hidden className={props.classNames}>
      {props.uiText}
    </span>
    <span className='visuallyhidden'>
      {props.screenReaderText.toLowerCase()}
    </span>
  </>
);

export default AriaText;
