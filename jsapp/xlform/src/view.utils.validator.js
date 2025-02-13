/* global viewUtils */
'use strict';

/*
    Options:
        Validations: array containing validation descriptors:
            name:string - the name of the validator function to invoke
            failureMessage:string - the message passed to the callback when validation fails
            args:array - additional arguments to pass into the validation function
*/
module.exports = (function(){

return (function () {
    var singleton = {
            create: function (options) {
                return new Validator(options);
            },
            __validators: {
                invalidChars: function (value, chars) {
                    var matcher = new RegExp('[' + chars + ']');
                    return !matcher.test(value);
                },
                unique: function (value, list) {
                    return _.filter(list, function (item) { return item === value; }).length === 0;
                }
            }
        };


    var Validator = function (options) {
        this.options = options;
    };

    Validator.prototype.validate = function (value) {
        var validationsLength = this.options.validations.length,
            validations = this.options.validations;

        for (var i = 0; i < validationsLength; i++) {
            var currentValidation = validations[i];
            if (!currentValidation.args) {
                currentValidation.args = [];
            }
            currentValidation.args.unshift(value);

            if (!singleton.__validators[currentValidation.name].apply(this, currentValidation.args)) {
                return currentValidation.failureMessage;
            }
        }
        return true;
    };

    return singleton;

} ());

})();
