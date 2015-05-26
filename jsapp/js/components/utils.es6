export var log = function (...args) {
  console.log.apply(console, args);
  return args[0];
};


// t will start out as a placeholder for a translation method
export var t = function (str) {
  return str;
};
