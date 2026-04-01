// 📘 generated from ./model.base.civet 
// "civet coffeeCompat"
// 'civet autoConst'
// wip

import _ from 'underscore'
import Backbone, { type Model } from 'backbone'
import validation from 'backbone-validation'

// [ ] view.utils
import $viewUtils from './view.utils'
// [x] model.configs
// [x] comment model.configs.d.ts
import $configs from './model.configs'
// [ ] rowDetailMixins
import $rowDetailMixins from './model.rowDetailMixins'

import { type Survey } from './model.survey'
// import { type SurveyFragment, type Group } from ./model.surveyFragment


// TODO: look at preinitialize
// module.exports = do ->

_.extend(validation.validators, {
  invalidChars(value: string, _attr: string, chars: string) {
    if (!$viewUtils.Validator.__validators.invalidChars(value, chars)) {
      return '#{value} contains invalid characters'
    } return
  },
  unique(value: string, _attr: string, _customValue: any, model: RowDetail) {
    const rows = model.getSurvey()!.rows.pluck(model.key)
    const values = _.map(rows, (rd) => rd.get('value'))
    if (!$viewUtils.Validator.__validators.unique(value, values)) {
      return "Question name isn't unique"
    }
    return
  },
})

_.extend(Backbone.Model.prototype, validation.mixin)

// TODO
// base = {}
// type _Models = TModel[] | Array<Record<string, any>>, options?: any
// type BaseCollectionOptions = { _parent?: BaseCollection } | undefined


class BaseCollection extends Backbone.Collection {
  _parent: BaseCollection | undefined = undefined
  constructor(models: Model[], opts?: { _parent?: BaseCollection }) {
    super(models, opts)
    if (opts?._parent) this._parent = opts._parent
    // @ts-expect-error
    if (models?._parent) {
      // temporary error, during transition
      throw new Error('_parent chould be assigned as property to 2nd argument to XLF.BaseCollection (not first)')
    }
  }

  getSurvey() {
    let parent = this._parent
    while (parent?._parent) {
      parent = parent._parent
    }
    return parent as unknown as Survey
  }
}

class BaseModel extends Backbone.Model {
  _parent: BaseModel | BaseCollection | undefined = undefined


  preinitialize(
    attributes?:  { _parent?: BaseModel | BaseCollection | undefined },
    options?:     { _parent?: BaseModel | BaseCollection | undefined },
  ) {
    if (options?._parent) {
      return this._parent = options._parent
    } else if (attributes?._parent) {
      this._parent = attributes._parent
      return delete attributes._parent
    } return
  }

  constructor(
    attributes?:  { _parent?: BaseModel | BaseCollection | undefined },
    options?:     { _parent?: BaseModel | BaseCollection | undefined },
  ) {
    super(attributes, options)
  }

  parse()     {}
  linkUp(_ctx: {warnings: string[], errors: string[]}) {}
  finalize()  {}
  getValue(what: string) {
    if (what) {
      let resp = this.get(what)
      if (resp === undefined) {
        throw new Error('Could not get value')
      }
      if (resp.getValue) {
        return resp.getValue()
      }
    }
    return this.get('value')
  }
  // FIXME: any?
  setDetail(what: string, value: any) {
    if (value.constructor === RowDetail) {
      this.set(what, value)
    } else {
      this.set(what, new RowDetail({key:what, value: value}, {_parent: this}))
    }
    return
  }
  parentRow() {
    return this._parent!._parent
  }
  precedingRow() {
    const ii = (this._parent as BaseCollection).models.indexOf(this)
    if (ii !== 0) {
      return (this._parent as BaseCollection)!.at(ii-1)
    } return
  }
  nextRow() {
    const ii =(this._parent as BaseCollection).models.indexOf(this)
    return (this._parent as BaseCollection).at(ii+1)
  }
  getSurvey() {
    let parent = this._parent
    if (parent === null || parent === undefined) {
      return null
    }
    while (parent?._parent || (parent as BaseModel).collection) {
      if (parent?._parent) {
        parent = parent._parent
      }

      // TODO: revisit these types when further understanding?
      else if (((parent as BaseModel).collection as unknown as BaseCollection)._parent) {
        parent = ((parent as BaseModel).collection as unknown as BaseCollection)._parent
      } else {
        break
      }
    }
    return parent as unknown as Survey
  }
}

const _innerValue = (val: { value: any } | any) => {
  // occasionally, the value passed to rowDetail
  // is an object, which evaluates to true
  if (_.isObject(val)) {
    return val.value
  } else {
    return val
  }
}

class RowDetail extends BaseModel {
  idAttribute = 'name'


  key:      string
  _parent:  BaseModel | BaseCollection

  _order:   number

  hidden:  boolean | undefined
  _oValue: any

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

  // @ts-expect-error No overlap in options.
  // FIXME later - and does it matter that we do this before the constructor?
  preinitialize( attrs: { key: string }, opts: any) {
    this.key = attrs.key
    this._parent = opts._parent
    if (this.key in $rowDetailMixins) {
      return _.extend(this, $rowDetailMixins[this.key as keyof typeof $rowDetailMixins])
    } return
  }

  constructor(attrs: { key: string, value: any }, opts: any) {
    // @ts-expect-error No overlap
    // FIXME later
    super(attrs, opts)
    // We should consider pulling the value from the CSV at this stage
    // depending on the question type. truthy-CSV values should be set here
    // In the quick fix, this is done in the view for 'required' rowDetails
    // (grep: XLF.configs.truthyValues)

    // HACK for TS, fixme later
    this.key = attrs.key
    this._parent = opts._parent
    // ------------------------

    const { value } = attrs

    if (!(value in [undefined, null])) {
      if (_.isString(value) || _.isNumber(value)) {
        this.set({ value })
      } else if (_.isObject(value) && value.value) {
        this.set({ ...value })
      } else {
        this.set({ value })
      }
    }

    this._order = $configs.columnOrder(this.key)
    this.hidden = undefined
    this.postInitialize()
  }

  postInitialize(): void{}
  initialize():     void {
    // todo: change "_hideUnlessChanged" to describe something about the form, not the representation of the form.
    // E.g. undefinedUnlessChanged or definedIffChanged
    if (this.get('_hideUnlessChanged')) {
      this.hidden = true
      this._oValue = this.get('value')
      this.on('change', () => {
        this.hidden = this.get('value') === this._oValue
        
      })
    }

    this.on('change:value', (_rd, val, ctxt) => {
      // @_parent.trigger "change", @key, val, ctxt
      this._parent.trigger('detail-change', this.key, val, ctxt)
      this.getSurvey()!.trigger('row-detail-change', this._parent, this.key, val, ctxt)
    // if @key is "type"
    //   @on "change:list", (rd, val, ctxt)=>
    //     @_parent.trigger "change", @key, val, ctxt
      
    })


    // when attributes change, register changes with parent survey
    if (this.key in ['name', 'label', 'hint', 'guidance_hint', 'required',
                'calculation', 'default', 'appearance',
                'constraint_message', 'tags'] || this.key.match(/^.+::.+/)) {
      this.on('change', (changes) => {
        this.getSurvey()!.trigger('change', changes)
        
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
