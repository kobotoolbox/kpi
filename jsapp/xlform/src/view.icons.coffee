_ = require 'underscore'
Backbone = require 'backbone'
constants = require '../../js/constants'

module.exports = do ->
  _t = require("utils").t

  addIconToRow = (typeDef, group) =>
    iconDetails.push({
      label: typeDef.label,
      faClass: typeDef.faIcon.replace("fa-", ""),
      grouping: group,
      id: typeDef.id
    })
    return

  iconDetails = []
  # row 1
  addIconToRow(constants.QUESTION_TYPES.get("select_one"),  "r1")
  addIconToRow(constants.QUESTION_TYPES.get("select_multiple"), "r1")
  addIconToRow(constants.QUESTION_TYPES.get("text"), "r1")
  addIconToRow(constants.QUESTION_TYPES.get("integer"), "r1")
  # row 2
  addIconToRow(constants.QUESTION_TYPES.get("decimal"), "r2")
  addIconToRow(constants.QUESTION_TYPES.get("date"), "r2")
  addIconToRow(constants.QUESTION_TYPES.get("time"), "r2")
  addIconToRow(constants.QUESTION_TYPES.get("datetime"), "r2")
  # row 3
  addIconToRow(constants.QUESTION_TYPES.get("geopoint"), "r3")
  addIconToRow(constants.QUESTION_TYPES.get("image"), "r3")
  addIconToRow(constants.QUESTION_TYPES.get("audio"), "r3")
  addIconToRow(constants.QUESTION_TYPES.get("video"), "r3")
  # row 4
  addIconToRow(constants.QUESTION_TYPES.get("geotrace"), "r4")
  addIconToRow(constants.QUESTION_TYPES.get("note"), "r4")
  addIconToRow(constants.QUESTION_TYPES.get("barcode"), "r4")
  addIconToRow(constants.QUESTION_TYPES.get("acknowledge"), "r4")
  # row 5
  addIconToRow(constants.QUESTION_TYPES.get("geoshape"), "r5")
  addIconToRow(constants.QUESTION_TYPES.get("score"), "r5")
  addIconToRow(constants.QUESTION_TYPES.get("kobomatrix"), "r5")
  addIconToRow(constants.QUESTION_TYPES.get("rank"), "r5")
  # row 6
  addIconToRow(constants.QUESTION_TYPES.get("calculate"), "r6")
  addIconToRow(constants.QUESTION_TYPES.get("hidden"), "r6")
  addIconToRow(constants.QUESTION_TYPES.get("file"), "r6")
  addIconToRow(constants.QUESTION_TYPES.get("range"), "r6")

  class QtypeIcon extends Backbone.Model
    defaults:
      faClass: "question-circle"

  class QtypeIconCollection extends Backbone.Collection
    model: QtypeIcon
    grouped: ()->
      unless @_groups
        @_groups = []
        grp_keys = []
        @each (model)=>
          grping = model.get("grouping")
          grp_keys.push(grping)  unless grping in grp_keys
          ii = grp_keys.indexOf(grping)
          @_groups[ii] or @_groups[ii] = []
          @_groups[ii].push model
      _.zip.apply(null, @_groups)

  new QtypeIconCollection(iconDetails)
