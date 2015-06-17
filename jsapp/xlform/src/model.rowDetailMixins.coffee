define 'cs!xlform/model.rowDetailMixins', [
        'cs!xlform/mv.skipLogicHelpers',
        'xlform/model.rowDetails.skipLogic',
        'cs!xlform/view.rowDetail.SkipLogic',
        'cs!xlform/model.utils',
        'cs!xlform/mv.validationLogicHelpers',
        'cs!xlform/model.rowDetail.validationLogic',
        'cs!xlform/view.rowDetail.ValidationLogic'
        ], (
            $skipLogicHelpers,
            $modelRowDetailsSkipLogic,
            $viewRowDetailSkipLogic,
            $modelUtils,
            $validationLogicHelpers,
            $modelRowDetailValidationLogic,
            $viewRowDetailValidationLogic
            )->
  # To be extended ontop of a RowDetail when the key matches
  # the attribute in XLF.RowDetailMixin
  SkipLogicDetailMixin =
    getValue: ()->
      v = @serialize()
      if v is "undefined"
        trackJs?.console.error("Serialized value is returning a string, undefined")
        v = ""
      v

    postInitialize: ()->
      # TODO: get skip logic factories connected
      survey = @getSurvey()
      model_factory = new $modelRowDetailsSkipLogic.SkipLogicFactory survey
      view_factory = new $viewRowDetailSkipLogic.SkipLogicViewFactory survey
      helper_factory = new $skipLogicHelpers.SkipLogicHelperFactory model_factory, view_factory, survey, @_parent, @.get('value')

      @facade = new $skipLogicHelpers.SkipLogicPresentationFacade model_factory, helper_factory, view_factory

    serialize: ()->
      # @hidden = false
      # note: reimplement "hidden" if response is invalid
      @facade.serialize()

    parse: ()->

    linkUp: (ctx)->
      @facade.initialize()

  ValidationLogicMixin =
    getValue: () ->
      v = @serialize()
      if v is "undefined"
        trackJs?.console.error("Serialized value is returning a string, undefined")
        v = ""
      v

    postInitialize: () ->
      survey = @getSurvey()
      model_factory = new $modelRowDetailValidationLogic.ValidationLogicModelFactory survey
      view_factory = new $viewRowDetailValidationLogic.ValidationLogicViewFactory survey
      helper_factory = new $validationLogicHelpers.ValidationLogicHelperFactory model_factory, view_factory, survey, @_parent, @.get('value')

      @facade = new $skipLogicHelpers.SkipLogicPresentationFacade model_factory, helper_factory, view_factory

    serialize: ()->
      # @hidden = false
      # note: reimplement "hidden" if response is invalid
      @facade.serialize()

    parse: ()->

    linkUp: (ctx)->
      @facade.initialize()

  rowDetailMixins =
    relevant: SkipLogicDetailMixin
    constraint: ValidationLogicMixin
    label:
      postInitialize: ()->
        # When the row's name changes, trigger the row's [finalize] function.
        return
    name:
      deduplicate: (survey) ->
        names = []
        survey.forEachRow (r)=>
          if r.get('name') != @
            name = r.getValue("name")
            names.push(name)
        , includeGroups: true

        $modelUtils.sluggifyLabel @get('value'), names
  rowDetailMixins
