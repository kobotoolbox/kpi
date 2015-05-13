export var log = function (...args) {
  console.log.apply(console, args);
  return args[0];
};