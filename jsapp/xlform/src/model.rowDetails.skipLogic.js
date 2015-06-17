define('xlform/model.rowDetails.skipLogic', [
        'backbone',
        'cs!xlform/model.utils',
        'cs!xlform/mv.skipLogicHelpers'
        ], function(
                    Backbone,
                    $utils,
                    $skipLogicHelpers
                    ) {

var __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

var rowDetailsSkipLogic = {};

  /**-----------------------------------------------------------------------------------------------------------
   * Factories.RowDetail.SkipLogic.coffee
   -----------------------------------------------------------------------------------------------------------**/

rowDetailsSkipLogic.SkipLogicFactory = (function() {
    SkipLogicFactory.prototype.create_operator = function(type, symbol, id) {
        var operator;
        switch (type) {
            case 'text':
                operator = new rowDetailsSkipLogic.TextOperator(symbol);
                break;
            case 'date':
                operator = new rowDetailsSkipLogic.DateOperator(symbol);
                break;
            case 'basic':
                operator = new rowDetailsSkipLogic.SkipLogicOperator(symbol);
                break;
            case 'existence':
                operator = new rowDetailsSkipLogic.ExistenceSkipLogicOperator(symbol);
                break;
            case 'select_multiple':
                operator = new rowDetailsSkipLogic.SelectMultipleSkipLogicOperator(symbol);
                break;
            case 'empty':
                return new rowDetailsSkipLogic.EmptyOperator();
        }
        operator.set('id', id);
        return operator;
    };

    SkipLogicFactory.prototype.create_criterion_model = function() {
        return new rowDetailsSkipLogic.SkipLogicCriterion(this, this.survey);
    };

    SkipLogicFactory.prototype.create_response_model = function(type) {
        var model;
        model = null;
        switch (type) {
            case 'integer':
                model = new rowDetailsSkipLogic.IntegerResponseModel;
                break;
            case 'decimal':
                model = new rowDetailsSkipLogic.DecimalResponseModel;
                break;
            default:
                model = new rowDetailsSkipLogic.ResponseModel(type);
        }
        return model.set('type', type);
    };

    function SkipLogicFactory(survey) {
        this.survey = survey;
    }

    return SkipLogicFactory;

})();

  /**-----------------------------------------------------------------------------------------------------------
   * Model.RowDetail.SkipLogic.Criterion.js
   -----------------------------------------------------------------------------------------------------------**/

rowDetailsSkipLogic.SkipLogicCriterion = (function(_super) {
    __extends(SkipLogicCriterion, _super);

    SkipLogicCriterion.prototype.serialize = function() {
        var response_model;
        response_model = this.get('response_value');
        if ((response_model != null) && (this.get('operator') != null) && (this.get('question_cid') != null) && response_model.isValid() !== false && (response_model.get('value') != null) && this._get_question()) {
            this._get_question().finalize();
            var questionName = this._get_question().getValue('name');
            return this.get('operator').serialize(questionName, response_model.get('value'));
        } else {
            return '';
        }
    };

    SkipLogicCriterion.prototype._get_question = function() {
        return this.survey.findRowByCid(this.get('question_cid'), { includeGroups: true });
    };

    SkipLogicCriterion.prototype.change_question = function(cid) {
        var old_question_type, question_type, _ref, _ref1, _ref2;
        old_question_type = ((_ref = this._get_question()) ? _ref.get_type() : void 0) || {
            name: null
        };
        this.set('question_cid', cid);
        question_type = this._get_question().get_type();
        if (_ref1 = this.get('operator').get_id(), __indexOf.call(question_type.operators, _ref1) < 0) {
            this.change_operator(question_type.operators[0]);
        } else if (old_question_type.name !== question_type.name) {
            this.change_operator(this.get('operator').get_value());
        }
        if ((this.get('operator').get_type().response_type == null) && this._get_question().response_type !== ((_ref2 = this.get('response_value')) != null ? _ref2.get_type() : void 0)) {
            return this.change_response((response_model = this.get('response_value')) != null ? (this._get_question()._isSelectQuestion() ? response_model.get('cid'): response_model.get('value')) : '');
        }
    };

    SkipLogicCriterion.prototype.change_operator = function(operator) {
        var is_negated, operator_model, question_type, symbol, type, _ref, _ref1;
        operator = +operator;
        is_negated = false;
        if (operator < 0) {
            is_negated = true;
            operator *= -1;
        }
        question_type = this._get_question().get_type();
        if (!(__indexOf.call(question_type.operators, operator) >= 0)) {
            return;
        }
        //get operator types
        type = $skipLogicHelpers.operator_types[operator - 1];
        symbol = type.symbol[type.parser_name[+is_negated]];
        operator_model = this.factory.create_operator((type.type === 'equality' ? question_type.equality_operator_type : type.type), symbol, operator);
        this.set('operator', operator_model);
        if ((type.response_type || question_type.response_type) !== ((_ref = this.get('response_value')) != null ? _ref.get('type') : void 0)) {
            return this.change_response(((_ref1 = this.get('response_value')) != null ? (this._get_question()._isSelectQuestion() ? _ref1.get('cid'): _ref1.get('value')) : void 0) || '');
        }
    };

    SkipLogicCriterion.prototype.get_correct_type = function() {
        return this.get('operator').get_type().response_type || this._get_question().get_type().response_type;
    };

    SkipLogicCriterion.prototype.set_option_names = function (options) {
            _.each(options, function(model) {
                if (model.get('name') == null) {
                    // get sluggify
                    return model.set('name', $utils.sluggify(model.get('label')));
                }
            });
    };

    SkipLogicCriterion.prototype.change_response = function(value) {
        var choice_cids, choices, current_value, response_model;
        response_model = this.get('response_value');
        if (!response_model || response_model.get('type') !== this.get_correct_type()) {
            response_model = this.factory.create_response_model(this.get_correct_type());
            this.set('response_value', response_model);
        }
        if (this.get_correct_type() === 'dropdown') {
            current_value = response_model ? response_model.get('cid') : null;

            var choicelist = this._get_question().getList();
            response_model.set('choicelist', choicelist);
            choices = choicelist.options.models;

            this.set_option_names(choices);

            choice_cids = _.map(choices, function(model) {
                return model.cid;
            });
            if (__indexOf.call(choice_cids, value) >= 0) {
                return response_model.set_value(value);
            } else if (__indexOf.call(choice_cids, current_value) >= 0) {
                return response_model.set_value(current_value);
            } else {
                return response_model.set_value(choices[0].cid);
            }
        } else {
            return response_model.set_value(value);
        }
    };

    function SkipLogicCriterion(factory, survey) {
        this.factory = factory;
        this.survey = survey;
        SkipLogicCriterion.__super__.constructor.call(this);
    }

    return SkipLogicCriterion;
})(Backbone.Model);

  /**-----------------------------------------------------------------------------------------------------------
   * Model.RowDetail.SkipLogic.Operators.js
   -----------------------------------------------------------------------------------------------------------**/

rowDetailsSkipLogic.Operator = (function(_super) {
    __extends(Operator, _super);

    function Operator() {
        return Operator.__super__.constructor.apply(this, arguments);
    }

    Operator.prototype.serialize = function(question_name, response_value) {
        throw new Error("Not Implemented");
    };

    Operator.prototype.get_value = function() {
        var val;
        val = '';
        if (this.get('is_negated')) {
            val = '-';
        }
        return val + this.get('id');
    };

    Operator.prototype.get_type = function() {
        // get operator types
        return $skipLogicHelpers.operator_types[this.get('id') - 1];
    };

    Operator.prototype.get_id = function() {
        return this.get('id');
    };

    return Operator;
    // get base model
})(Backbone.Model);

rowDetailsSkipLogic.EmptyOperator = (function(_super) {
    __extends(EmptyOperator, _super);

    EmptyOperator.prototype.serialize = function() {
        return '';
    };

    function EmptyOperator() {
        EmptyOperator.__super__.constructor.call(this);
        this.set('id', 0);
        this.set('is_negated', false);
    }

    return EmptyOperator;

})(rowDetailsSkipLogic.Operator);

rowDetailsSkipLogic.SkipLogicOperator = (function(_super) {
    __extends(SkipLogicOperator, _super);

    SkipLogicOperator.prototype.serialize = function(question_name, response_value) {
        return '${' + question_name + '} ' + this.get('symbol') + ' ' + response_value;
    };

    function SkipLogicOperator(symbol) {
        SkipLogicOperator.__super__.constructor.call(this);
        this.set('symbol', symbol);
        this.set('is_negated', ['!=', '<', '<='].indexOf(symbol) > -1);
    }

    return SkipLogicOperator;

})(rowDetailsSkipLogic.Operator);

rowDetailsSkipLogic.TextOperator = (function(_super) {
    __extends(TextOperator, _super);

    function TextOperator() {
        return TextOperator.__super__.constructor.apply(this, arguments);
    }

    TextOperator.prototype.serialize = function(question_name, response_value) {
        return TextOperator.__super__.serialize.call(this, question_name, "'" + response_value.replace(/'/g, "\\'") + "'");
    };

    return TextOperator;

})(rowDetailsSkipLogic.SkipLogicOperator);

rowDetailsSkipLogic.DateOperator = (function(_super) {
    __extends(DateOperator, _super);

    function DateOperator() {
        return DateOperator.__super__.constructor.apply(this, arguments);
    }

    DateOperator.prototype.serialize = function(question_name, response_value) {
        if (response_value.indexOf('date') == -1) {
            response_value = "date('" + response_value + "')"
        }
        return DateOperator.__super__.serialize.call(this, question_name, response_value);
    };

    return DateOperator;

})(rowDetailsSkipLogic.SkipLogicOperator);

rowDetailsSkipLogic.ExistenceSkipLogicOperator = (function(_super) {
    __extends(ExistenceSkipLogicOperator, _super);

    ExistenceSkipLogicOperator.prototype.serialize = function(question_name) {
        return ExistenceSkipLogicOperator.__super__.serialize.call(this, question_name, "''");
    };

    function ExistenceSkipLogicOperator(operator) {
        ExistenceSkipLogicOperator.__super__.constructor.call(this, operator);
        this.set('is_negated', operator === '=');
    }

    return ExistenceSkipLogicOperator;

})(rowDetailsSkipLogic.SkipLogicOperator);

rowDetailsSkipLogic.SelectMultipleSkipLogicOperator = (function(_super) {
    __extends(SelectMultipleSkipLogicOperator, _super);

    function SelectMultipleSkipLogicOperator() {
        return SelectMultipleSkipLogicOperator.__super__.constructor.apply(this, arguments);
    }

    SelectMultipleSkipLogicOperator.prototype.serialize = function(question_name, response_value) {
        var selected;
        selected = "selected(${" + question_name + "}, '" + response_value + "')";
        if (this.get('is_negated')) {
            return 'not(' + selected + ')';
        }
        return selected;
    };

    return SelectMultipleSkipLogicOperator;

})(rowDetailsSkipLogic.SkipLogicOperator);

  /**-----------------------------------------------------------------------------------------------------------
   * Model.RowDetail.SkipLogic.Responses.js
   -----------------------------------------------------------------------------------------------------------**/

rowDetailsSkipLogic.ResponseModel = (function(_super) {
    __extends(ResponseModel, _super);

    function ResponseModel(type) {
        ResponseModel.__super__.constructor.apply(this, []);
        if (type === 'dropdown') {
            this._set_value = this.set_value;
            this.set_value = function (cid) {
                var choice = this.get('choicelist').options.get(cid);
                if (choice) {
                    this._set_value(choice.get('name'));
                    this.set('cid', cid);
                }
            }
        }
    }

    ResponseModel.prototype.get_type = function() {
        return this.get('type');
    };

    ResponseModel.prototype.set_value = function(value) {
        return this.set('value', value, {
            validate: true
        });
    };

    return ResponseModel;
    // get base model
})(Backbone.Model);

rowDetailsSkipLogic.IntegerResponseModel = (function(_super) {
    __extends(IntegerResponseModel, _super);

    function IntegerResponseModel() {
        return IntegerResponseModel.__super__.constructor.apply(this, arguments);
    }

    IntegerResponseModel.prototype.validation = {
        value: {
            pattern: /^-?\d+$/,
            msg: 'Number must be integer'
        }
    };

    IntegerResponseModel.prototype.set_value = function(value) {
        if (value === ''){
            value = undefined;
        }
        return this.set('value', value, {
            validate: !!value
        });
    };

    return IntegerResponseModel;

})(rowDetailsSkipLogic.ResponseModel);

rowDetailsSkipLogic.DecimalResponseModel = (function(_super) {
    __extends(DecimalResponseModel, _super);

    function DecimalResponseModel() {
        return DecimalResponseModel.__super__.constructor.apply(this, arguments);
    }

    DecimalResponseModel.prototype.validation = {
        value: {
            pattern: 'number',
            msg: 'Number must be decimal'
        }
    };

    DecimalResponseModel.prototype.set_value = function(value) {
        function value_is_not_number() {
            return typeof value !== 'number';
        }

        if (typeof value === 'undefined' || value === '') {
            value = null;
        } else {
            if (value_is_not_number()) {
                value = value.replace(/\s/g, '');
                value = +value || value;
            }
            if (value_is_not_number()) {
                value = +(value.replace(',', '.')) || value;
            }
            if (value_is_not_number()) {
                if (value.lastIndexOf(',') > value.lastIndexOf('.')) {
                    value = +(value.replace(/\./g, '').replace(',', '.'));
                } else {
                    value = +(value.replace(',', ''));
                }
            }
        }
        return this.set('value', value, {
            validate: true
        });
    };

    return DecimalResponseModel;

})(rowDetailsSkipLogic.ResponseModel);

rowDetailsSkipLogic.DateResponseModel = (function(_super) {
    __extends(DateResponseModel, _super);

    function DateResponseModel() {
        return DateResponseModel.__super__.constructor.apply(this, arguments);
    }

    DateResponseModel.prototype.validation = {
        value: {
            pattern: /date\(\'\d{4}-\d{2}-\d{2}\'\)/
        }
    };

    DateResponseModel.prototype.set_value = function(value) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            value = "date('" + value + "')";
        }
        return this.set('value', value, {
            validate: true
        });
    };

    return DateResponseModel;

})(rowDetailsSkipLogic.ResponseModel);

return rowDetailsSkipLogic;

});
