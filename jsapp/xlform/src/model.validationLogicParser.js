'use strict';

define('xlform/model.validationLogicParser', ['xlform/model.validationLogicParserFactory'], function($factory) {
        return $factory(/(\.)\s*(=|!=|<|>|<=|>=)\s*\'?((?:date\(\'\d{4}-\d{2}-\d{2}\'\)|[\s\w]+|-?\d+)\.?\d*)\'?/,
                        /(\.)\s*((?:=|!=)\s*(?:NULL|''))/i,
                        / and | or /gi,
                        /selected\((\.)\s*,\s*\'(\w+)\'\)/);
});
