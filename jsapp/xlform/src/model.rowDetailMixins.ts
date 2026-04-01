// 📘 generated from ./model.rowDetailMixins.civet 

// FILE rowDetailMixins ==-----
var SkipLogicDetailMixin, ValidationLogicMixin, rowDetailMixins
import $skipLogicHelpers              from './mv.skipLogicHelpers'
import $modelRowDetailsSkipLogic      from './model.rowDetails.skipLogic'
import $viewRowDetailSkipLogic        from './view.rowDetail.SkipLogic'
import $modelUtils                    from './model.utils'
import $validationLogicHelpers        from './mv.validationLogicHelpers'
import $modelRowDetailValidationLogic from './model.rowDetail.validationLogic'
import $viewRowDetailValidationLogic  from './view.rowDetail.ValidationLogic'


import type { RowDetail } from './model.base'

// To be extended ontop of a RowDetail when the key matches
// the attribute in XLF.RowDetailMixin
SkipLogicDetailMixin = {
  getValue: function(){
    var v
    v = this.serialize()
    if (v === 'undefined') {
      Raven?.captureException('Serialized value is returning a string, undefined')
      v = ''
    }
    return v
  },

  postInitialize: function(){
    var survey, model_factory, view_factory, helper_factory
    survey = this.getSurvey()
    model_factory = new $modelRowDetailsSkipLogic.SkipLogicFactory(survey)
    view_factory = new $viewRowDetailSkipLogic.SkipLogicViewFactory(survey)
    helper_factory = new $skipLogicHelpers.SkipLogicHelperFactory(model_factory, view_factory, survey, this._parent, this.get('value'))

    return this.facade = new $skipLogicHelpers.SkipLogicPresentationFacade(model_factory, helper_factory, view_factory)
  },

  serialize: function(){
    // @hidden = false
    // note: reimplement "hidden" if response is invalid
    return this.facade.serialize()
  },

  parse: function(){},

  linkUp: function(ctx){
    return this.facade.initialize()
  },
}

ValidationLogicMixin = {
  getValue: function() {
    var v
    v = this.serialize()
    if (v === 'undefined') {
      Raven?.captureException('Serialized value is returning a string, undefined')
      v = ''
    }
    return v
  },

  postInitialize: function() {
    var survey, model_factory, view_factory, helper_factory
    survey = this.getSurvey()
    model_factory = new $modelRowDetailValidationLogic.ValidationLogicModelFactory(survey)
    view_factory = new $viewRowDetailValidationLogic.ValidationLogicViewFactory(survey)
    helper_factory = new $validationLogicHelpers.ValidationLogicHelperFactory(model_factory, view_factory, survey, this._parent, this.get('value'))

    return this.facade = new $skipLogicHelpers.SkipLogicPresentationFacade(model_factory, helper_factory, view_factory)
  },

  serialize: function(){
    // @hidden = false
    // note: reimplement "hidden" if response is invalid
    return this.facade.serialize()
  },

  parse: function(){},

  linkUp: function(ctx){
    return this.facade.initialize()
  },
}

rowDetailMixins = {
  relevant: SkipLogicDetailMixin,
  constraint: ValidationLogicMixin,
  file: {
    postInitialize: function(){
      var available_files, first_file, first_file_name
      available_files = this.getSurvey().availableFiles || []
      first_file = available_files[0]
      if (first_file) {
        if (this.attributes.value === 'DEFAULT_CHOICES_FILE') {
          first_file_name = first_file.metadata.filename
          return this.set('value', first_file_name)
        } return
      } return
    },
  },
  label: {
    postInitialize: function(){
      // When the row's name changes, trigger the row's [finalize] function.
      return
    },
  },
  name: {
    deduplicate: function(survey) {
      var names
      names = [] as string[]
      survey.forEachRow((r) => {
        var name
        if (r.get('name') !== this) {
          name = r.getValue('name')
          return names.push(name)
        } return
      },
       {includeGroups: true})

      return $modelUtils.sluggifyLabel(this.get('value'), names)
    },
  },
}

export default rowDetailMixins
