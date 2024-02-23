import {useRef} from "react";

let baseId = 0;

/** A simple polyfill for React's useId hook, using an auto-incrementing counter
 * Use this when you need a unique ID for a component that's rendered in multiple places
 * @param {string} prefix - string that will be added to the id - use all-lowercase-and-spaces
 **/
export const useId = (prefix: string) => {
  const id = useRef(baseId);
  // Don't try to increment beyond integer limit; just reset to zero
  // If we're using more than MAX_SAFE_INTEGER elements with unique IDs simultaneously,
  // it's safe to say that something went terribly wrong upstream of this component
  if (baseId >= Number.MAX_SAFE_INTEGER - 1){
    baseId = 0;
  }
  baseId++;
  // This isn't quite BEM, but let's mimic its structure for consistency
  return `kpi-id__${prefix}--${id.current}`;
};
