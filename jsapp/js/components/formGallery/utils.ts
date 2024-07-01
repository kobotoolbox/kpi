import type {Json} from '../common/common.interfaces';

/**
 * Find a key anywhere in an object (supports nesting)
 * Based on https://stackoverflow.com/a/15524326/443457
 * @param theObject - object to search
 * @param key - key to find
 * @returns value of the found key
 */
export function findByKey(theObject: Json, key: string): Json {
  let result = null;
  if (theObject instanceof Array) {
    for (let i = 0; i < theObject.length; i++) {
      result = findByKey(theObject[i], key);
      if (result) {
        break;
      }
    }
  } else if (theObject instanceof Object) {
    for (const prop in theObject) {
      if (prop === key) {
        return theObject[key];
      }
      if (
        theObject[prop] instanceof Array ||
        theObject[prop] instanceof Object
      ) {
        result = findByKey(theObject[prop], key);
        if (result) {
          break;
        }
      }
    }
  }
  return result;
}
