export var log = function (...args) {
  console.log.apply(console, args);
  return args[0];
};


var __strings = [];
// t will start out as a placeholder for a translation method
export var t = function (str) {
  if (__strings.indexOf(str) === -1) {
    __strings.push(str);
  }
  return str;
};

window.logStrings = function () {
  console.log(JSON.stringify(__strings, null, 4));
}
