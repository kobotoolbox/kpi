/* global _ */
/* global Backbone */
/* global viewUtils */
'use strict';

_.extend(Backbone.Validation.validators, {
    invalidChars: function (value, attr, customValue) {
        if(viewUtils.Validator.__validators.invalidChars(value, customValue)){
            return;
        }
        return value + 'contains invalid characters';
    },
    unique: function (value, attr, customValue, model) {
        var rows = model.getSurvey().rows.pluck(model.key);
        var values = _.map(
            rows,
            function (rd) {
                return rd.get('value');
            });


        if(viewUtils.Validator.__validators.unique(value, values)) {
            return;
        }
        return 'Question name isn\'t unique';
    }
});
