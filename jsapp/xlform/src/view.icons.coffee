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
      label: _t("Select Many")
      faClass: "list-ul"
      grouping: "r1"
      id: "select_multiple"
    ,
      label: _t("Text")
      faClass: "lato-text"
      grouping: "r1"
      id: "text"
    ,
      label: _t("Number")
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
      label: _t("Date")
      faClass: "calendar"
      grouping: "r2"
      id: "date"
    ,
      label: _t("Time")
      faClass: "clock-o"
      grouping: "r2"
      id: "time"
    ,
      label: _t("Date & time")
      faClass: "calendar clock-over"
      grouping: "r2"
      id: "datetime"
    ,

    # r3
      label: _t("GPS")
      faClass: "map-marker"
      grouping: "r3"
      id: "geopoint"
    ,
      label: _t("Photo")
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
      label: _t("Note")
      faClass: "bars"
      grouping: "r4"
      id: "note"
    ,
      label: _t("Barcode")
      faClass: "barcode"
      grouping: "r4"
      id: "barcode"
    ,
      label: _t("Acknowledge")
      faClass: "check-square-o"
      grouping: "r4"
      id: "acknowledge"
    ,
      label: _t("Calculate")
      faClass: "lato-calculate"
      grouping: "r4"
      id: "calculate"
    ,

    # r5
      label: _t("Matrix / Rating")
      # faClass: "server"
      # will look better but isn't available until FA 4.3
      faClass: "th"
      grouping: "r5"
      id: "score"
    ,
      label: _t("Ranking")
      faClass: "sort-amount-desc"
      grouping: "r5"
      id: "rank"
    ,
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
