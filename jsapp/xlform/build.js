require(['cs!xlform/_xlform.init']);

(function(){
  if (typeof module !== undefined) {
    module.exports = require('cs!xlform/_xlform.init');
  } else {
    this.dkobo_xlform = require('cs!xlform/_xlform.init');
  }
})();
