// 📘 generated from ./model.inputDeserializer.civet 

/*
// [inputDeserializer]
//  wrapper around methods for converting raw input into survey structure
// ______________________________________________________________________
*/

var _, csv, $aliases; var indexOf: <T>(this: T[], searchElement: T) => number = [].indexOf as any
_ = require('underscore')
csv = require('./csv')
$aliases = require('./model.aliases')

module.exports = (function() {
  var inputDeserializer, deserialize, validateParse
  inputDeserializer = function(inp, ctx={}){
    var r
    r = deserialize(inp, ctx)
    if (!ctx.error && ctx.validate) {
      validateParse(r, ctx)
    }
    return r
  }

  // [inputDeserializer.deserialize] parses csv string, json string,
  //  or object into survey object
  // -------------------------------
  deserialize = (function() {
    var _csv_to_params, _parse_sheets
    _csv_to_params = function(csv_repr){
      var cobj, out, sht
      cobj = csv.sheeted(csv_repr)
      out = {}

      let ref; if (sht = cobj.sheet('survey')) { ref = sht.toObjects() } else ref = []; out.survey = ref
      let ref1; if (sht = cobj.sheet('choices')) { ref1 = sht.toObjects() } else ref1 = []; out.choices = ref1
      if (sht = cobj.sheet('settings')) {
        out.settings = sht.toObjects()[0]
      }

      return out
    }

    _parse_sheets = function(repr){
      
      

      var shtName, sheet, out_sheet, cols, contents, row, new_row, col, i
      // If a sheet has a first-row which is an array, that array will be treated as column
      // headers and any subsequent array-rows will be matched up

      for (shtName in repr) {
 sheet = repr[shtName]
        if (_.isArray(sheet) && sheet.length > 0 && _.isArray(sheet[0])) {
          out_sheet = [];
          [cols, ...contents] = sheet
          for (let i1 = 0, len = contents.length; i1 < len; i1++) {
 row = contents[i1]
            if (_.isArray(row)) {
              new_row = {}
              for (let i2 = 0, len1 = cols.length; i2 < len1; i2++) {
 col = cols[i=i2]
                if (i < row.length && indexOf.call([undefined, null], row[i]) < 0) {
                  new_row[col] = row[i]
                }
              }
              out_sheet.push(new_row)
            } else {
              out_sheet.push(row)
            }
          }
          repr[shtName] = out_sheet
        }
      }
      return repr
    }

    // returns: function
    return function(repr, ctx={}){
      if (_.isString(repr)) {
        return _csv_to_params(repr)
      } else if (_.isObject(repr)) {
        return _parse_sheets(repr)
      } else {}
    }
  })()

  // [inputDeserializer.validateParse]
  //  ensure correct sheet names exist in imported surveys
  // ---------------------------------
  validateParse = (function() {
    var requiredSheetNameList
    requiredSheetNameList = $aliases.q.requiredSheetNameList()

    // returns: function
    return function(repr, ctx={}){
      var valid_with_sheet, sn, sheetId
      valid_with_sheet = false
      for (let i3 = 0, len2 = requiredSheetNameList.length; i3 < len2; i3++) {
 sheetId = requiredSheetNameList[i3]
        if (repr[sheetId]) {
          ctx.surveyType = sheetId
          valid_with_sheet = true
        }
      }
      if (repr['settings']) { ctx.settings = true }
      if (repr['choices']) { ctx.choices = true }
      if (!valid_with_sheet) {
        sn = requiredSheetNameList.join(', ')
        ctx.error = `Missing a survey sheet [${sn}]`
      }
      return !ctx.error
    }
  })()

  inputDeserializer.validateParse = validateParse
  inputDeserializer.deserialize = deserialize
  return inputDeserializer
})()
