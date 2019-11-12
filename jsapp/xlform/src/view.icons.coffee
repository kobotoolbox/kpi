_ = require 'underscore'
Backbone = require 'backbone'

module.exports = do ->
  _t = require("utils").t

  iconDetails = [
    # row 1
      label: _t("Select One")
      faClass: "dot-circle-o"
      grouping: "r1"
      id: "select_one"
    ,
      label: _t("Select Multiple")
      faClass: "list-ul"
      grouping: "r1"
      id: "select_multiple"
    ,
      label: _t("Text")
      faClass: "lato-text"
      grouping: "r1"
      id: "text"
    ,
      label: _t("Integer")
      faClass: "lato-integer"
      grouping: "r1"
      id: "integer"
    ,

    # row 2
      label: _t("Decimal")
      faClass: "lato-decimal"
      grouping: "r2"
      id: "decimal"
    ,
      label: _t("Calculate")
      faClass: "lato-calculate"
      grouping: "r2"
      id: "calculate"
    ,
      label: _t("Date")
      faClass: "calendar"
      grouping: "r2"
      id: "date"
    ,
      label: _t("Note")
      faClass: "bars"
      grouping: "r2"
      id: "note"
    ,

    # r3
      label: _t("File")
      faClass: "file"
      grouping: "r3"
      id: "file"
    ,
      label: _t("Image")
      faClass: "picture-o"
      grouping: "r3"
      id: "image"
    ,
      label: _t("Audio")
      faClass: "volume-up"
      grouping: "r3"
      id: "audio"
    ,
      label: _t("Video")
      faClass: "video-camera"
      grouping: "r3"
      id: "video"
    ,

    # r4
      label: _t("Acknowledge")
      faClass: "check-square-o"
      grouping: "r4"
      id: "acknowledge"
    ,
      label: _t("Range")
      faClass: "lato-range"
      grouping: "r4"
      id: "range"
    ,
    # r5

    # r6
    ]

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
