'use strict';
var $factory = require('./model.validationLogicParserFactory');

module.exports = (function(){
    return $factory(/^\${(\w+)}\s*(=|!=|<|>|<=|>=)\s*\'?((?:date\(\'\d{4}-\d{2}-\d{2}\'\)|[\s\w]+|-?\d+)\.?\d*)\'?/,
                    /\${(\w+)}\s*((?:=|!=)\s*(?:NULL|''))/i,
                    / and | or /gi,
                    /selected\(\$\{(\w+)\},\s*\'(\w+)\'\)/);
})();
