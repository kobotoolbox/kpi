/* global _ */
/* global Backbone */
/* global viewUtils */

_.extend(Backbone.Validation.validators, {
  invalidChars: (value, attr, customValue) => {
    if (viewUtils.Validator.__validators.invalidChars(value, customValue)) {
      return
    }
    return value + 'contains invalid characters'
  },
  unique: (value, attr, customValue, model) => {
    var rows = model.getSurvey().rows.pluck(model.key)
    var values = _.map(rows, (rd) => rd.get('value'))

    if (viewUtils.Validator.__validators.unique(value, values)) {
      return
    }
    return "Question name isn't unique"
  },
})
