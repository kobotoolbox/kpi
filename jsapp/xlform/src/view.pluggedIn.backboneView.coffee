###
This file is intended to ensure that modules that use external plugins
have access to those plugins and a proper error message is
displayed.
###

Backbone = require 'backbone'
@jQuery = $
select2 = require 'select2'

module.exports = do ->
  missingPlugins = []
  errorMessageUnlessExists = (base, param, message)->
    unless base[param]
      missingPlugins.push "'#{param}': '#{message}'"

  # these dependency checks are breaking unnecessarily
  # errorMessageUnlessExists $.fn, "editable", "jquery x-editable"
  # errorMessageUnlessExists $.fn, "select2", "select2"
  # errorMessageUnlessExists $.fn, "sortable", "jquery-ui sortable"
  # errorMessageUnlessExists Backbone.Model.prototype, "Validation"

  if missingPlugins.length > 0
    throw new Error("Missing plugin(s): {#{missingPlugins.join(', ')}}")

  Backbone.View
