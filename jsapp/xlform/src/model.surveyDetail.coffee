base = require './model.base'

module.exports = do ->

  # SurveyDetails (attached to a XLF.Survey instance) containing details such as
  #     start time, deviceid, (etc.)
  class SurveyDetail extends base.BaseModel
    idAttribute: "name"

    toJSON: ()->
      if @get("value")
        out = {}

        out.name = @get("name")
        # type is same as name
        out.type = out.name

        parameters = @get("parameters")
        if parameters
          out.parameters = parameters

        return out
      else
        return false

  class SurveyDetails extends base.BaseCollection
    model: SurveyDetail

    loadSchema: (schema)->
      # throw new Error("Schema must be a Backbone.Collection")  unless schema instanceof Backbone.Collection
      for item in schema.models
        @add(new SurveyDetail(item._forSurvey()))
      @_schema = schema

      # we could prevent future changes to the schema...
      @add = @loadSchema = ()-> throw new Error("New survey details must be added to the schema")
      return @

    importDefaults: ()->
      for item in @_schema.models
        relevantDetail = @get(item.get("name"))
        relevantDetail.set("value", item.get("default"))
      return

    importDetail: (detail)->
      # For now, every detail which is presented is given a boolean value set to true
      if (dtobj = @get(detail.type))
        if detail.parameters
          dtobj.set("parameters", detail.parameters)
        dtobj.set("value", true)
      else
        throw new Error("SurveyDetail `#{key}` not loaded from schema. [Aliases have not been implemented]")
      return

  SurveyDetails: SurveyDetails
  SurveyDetail: SurveyDetail
