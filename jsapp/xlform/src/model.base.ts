// 📘 generated from ./model.base.civet 
// "civet coffeeCompat"
// wip

import _ from 'underscore'
import Backbone from 'backbone'
import validation from 'backbone-validation'

// [ ] view.utils
import $viewUtils from './view.utils'
// [x] model.configs
// [x] comment model.configs.d.ts
import $configs from './model.configs'
// [ ] rowDetailMixins
import $rowDetailMixins from './model.rowDetailMixins'

// FIXME convert to module
// FIXME comment out base d.ts

// module.exports = do ->

_.extend(validation.validators, {
  invalidChars(value: string, _attr: string, chars: string) {
    if (!$viewUtils.Validator.__validators.invalidChars(value, chars)) {
      return '#{value} contains invalid characters'
    } return
  },
  unique(value: string, _attr: string, _customValue: any, model) {
    const rows = model.getSurvey().rows.pluck(model.key)
    const values = _.map(rows, function(rd){ return rd.get('value') })
    if (!$viewUtils.Validator.__validators.unique(value, values)) {
      return "Question name isn't unique"
    } else {
      return
    }
  },
})

_.extend(Backbone.Model.prototype, validation.mixin)

// TODO
// base = {}

class BaseCollection extends Backbone.Collection {
  constructor(models, opts) {
    super(models, opts)
    if (opts?._parent) this._parent = opts._parent
    if (models?._parent) {
      // temporary error, during transition
      throw new Error('_parent chould be assigned as property to 2nd argument to XLF.BaseCollection (not first)')
    }
  }

  getSurvey() {
    let parent = this._parent
    while (parent._parent) {
      parent = parent._parent
    }
    return parent
  }
}

class BaseModel extends Backbone.Model {
  constructor(models, opts) {
    super(models, opts)
    if (opts?._parent) {
      this._parent = opts._parent
    } else if (models?._parent) {
      this._parent = models._parent
      delete models._parent
    }
  }
  parse()     {}
  linkUp(ctx) {}
  finalize()  {}
  getValue(what) {
    if (what) {
      const resp = this.get(what)
      if (resp === undefined) {
        throw new Error('Could not get value')
      }
      if (resp.getValue) {
        resp = resp.getValue()
      }
    } else {
      const resp = this.get('value')
    }
    return resp
  }
  setDetail(what, value) {
    if (value.constructor === RowDetail) {
      this.set(what, value)
    } else {
      this.set(what, new RowDetail({key:what, value: value}, {_parent: this}))
    }
    return
  }
  parentRow() {
    return this._parent._parent
  }
  precedingRow() {
    const ii = this._parent.models.indexOf(this)
    if (ii(isnt(0))) {
      return this._parent.at(ii-1)
    } return
  }
  nextRow() {
    const ii = this._parent.models.indexOf(this)
    return this._parent.at(ii+1)
  }
  getSurvey() {
    const parent = this._parent
    if (parent === null || parent === undefined) {
      return null
    }
    while (parent._parent || parent.collection) {
      if (parent._parent) {
        parent = parent._parent
      } else if (parent.collection && parent.collection._parent) {
        parent = parent.collection._parent
      } else {
        break
      }
    }
    return parent
  }
}

const _innerValue = (val) => {
  // occasionally, the value passed to rowDetail
  // is an object, which evaluates to true
  if (_.isObject(val)) {
    return val.value
  } else {
    return val
  }
}

class RowDetail extends BaseModel {
  idAttribute: 'name'
  validation() {
    if (this.key == 'name') {
      return {value: {
        unique: true,
        required: true,
      }}
    } else if (this.key == 'calculation') {
      return {value: {
        required: true,
      }}
    } else if (this.key == 'label' && this._parent.constructor.key != 'group') {
      return {value: {
        required: true,
      }}
    }
    return {}
  }

  constructor({key: key1, value}, opts) {
    this._parent = opts._parent
    if (this.key) of($rowDetailMixins(
      _.extend(this, $rowDetailMixins[this.key])))
    super()
    this.key = key1
    // We should consider pulling the value from the CSV at this stage
    // depending on the question type. truthy-CSV values should be set here
    // In the quick fix, this is done in the view for 'required' rowDetails
    // (grep: XLF.configs.truthyValues)

    if (!(value in [undefined, null])) {
      const vals2set = {}
      if (_.isString(value) || _.isNumber(value)) {
        vals2set.value = value
      } else if (_.isObject(value) && value.value) {
        _.extend(vals2set, value)
      } else {
        vals2set.value = value
      }
      this.set(vals2set)
    }

    this._order = $configs.columnOrder(this.key)
    this.postInitialize()
  }

  postInitialize() {}
  initialize() {
    // todo: change "_hideUnlessChanged" to describe something about the form, not the representation of the form.
    // E.g. undefinedUnlessChanged or definedIffChanged
    if (this.get('_hideUnlessChanged')) {
      this.hidden = true
      this._oValue = this.get('value')
      this.on('change', function(){
        this.hidden = this.get('value') === this._oValue
        return
      })
    }

    this.on('change:value', (rd, val, ctxt) => {
      // @_parent.trigger "change", @key, val, ctxt
      this._parent.trigger('detail-change', this.key, val, ctxt)
      this.getSurvey().trigger('row-detail-change', this._parent, this.key, val, ctxt)
    // if @key is "type"
    //   @on "change:list", (rd, val, ctxt)=>
    //     @_parent.trigger "change", @key, val, ctxt
      return
    })

    // when attributes change, register changes with parent survey
    if (this.key in ['name', 'label', 'hint', 'guidance_hint', 'required',
                'calculation', 'default', 'appearance',
                'constraint_message', 'tags'] || this.key.match(/^.+::.+/)) {
      this.on('change', (changes) => {
        this.getSurvey().trigger('change', changes)
        return
      })
    }
    return
  }
}


const base = {
  BaseCollection,
  BaseModel,
  RowDetail,
}

export default base

export type {
  BaseCollection,
  BaseModel,
  RowDetail,
}
