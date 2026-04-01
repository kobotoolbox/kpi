// 📘 generated from ./model.surveyDetail.civet 

import { type Collection } from 'backbone'

import base from './model.base'

// SurveyDetails (attached to a XLF.Survey instance) containing details such as
//     start time, deviceid, (etc.)
class SurveyDetail extends base.BaseModel {
  idAttribute = 'name'

  toJSON() {
    if (this.get('value')) {
      const name = this.get('name')
      // type is same as name
      const type = name

      const out = { name, type }
      const parameters = this.get('parameters')
      if (parameters) return { parameters, ...out }
      return out
    } else {
      return false
    }
  }
}

class SurveyDetails extends base.BaseCollection {
  model = SurveyDetail

  loadSchema(schema: Collection ){
    
    var item
    // throw new Error("Schema must be a Backbone.Collection")  unless schema instanceof Backbone.Collection
    for (let ref = schema.models, i = 0, len = ref.length; i < len; i++) {
 item = ref[i]
      this.add(new SurveyDetail(item._forSurvey(), undefined))
    }
    this._schema = schema

    // we could prevent future changes to the schema...
    this.add = this.loadSchema = function(){ throw new Error('New survey details must be added to the schema') }
    return this
  }

  importDefaults(){
    var item, relevantDetail
    for (let ref1 = this._schema.models, i1 = 0, len1 = ref1.length; i1 < len1; i1++) {
 item = ref1[i1]
      relevantDetail = this.get(item.get('name'))
      relevantDetail.set('value', item.get('default'))
    }
    return
  }

  importDetail(detail: SurveyDetail){
    
    var dtobj
    // For now, every detail which is presented is given a boolean value set to true
    if (dtobj = this.get(detail.type)) {
      if (detail.parameters) {
        dtobj.set('parameters', detail.parameters)
      }
      if (dtobj.get('deprecated')) {
        // …unless the detail (aka metadata) is deprecated, in which case its
        // value is forced to the default
        dtobj.set('value', dtobj.get('default'))
      } else {
        dtobj.set('value', true)
      }
    } else {
      throw new Error(`SurveyDetail \`${key}\` not loaded from schema. [Aliases have not been implemented]`)
    }
    return
  }
}


export default {
  SurveyDetails,
  SurveyDetail,
}

export {
  SurveyDetails,
  SurveyDetail,
}
