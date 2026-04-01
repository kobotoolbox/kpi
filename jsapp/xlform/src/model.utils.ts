// 📘 generated from ./model.utils.civet 

// TODO file: model.utils

var indexOf: <T>(this: T[], searchElement: T) => number = [].indexOf as any
import _ from 'underscore'
import $skipLogicParser from './model.skipLogicParser'
import $validationLogicParser from './model.validationLogicParser'

function _trim(str: string) {
  return str.replace(/^[\s\t\uFEFF\xA0]+|[\s\t\uFEFF\xA0]+$/g, '')
}

// export
// TODO(docs): add a better comment than in model.utils.d.ts
function split_paste(str: string) {
  var out, out_out, row, trimmed, orow, n, key, val
  out = []
  for (let ref = str.split('\n'), i = 0, len = ref.length; i < len; i++) {
 row = ref[i]
    trimmed = _trim(row)
    if (!trimmed.match(/^\s*$/)) {
      out.push(trimmed.split(/\t/))
    }
  }
  out_out = []
  for (let ref1 = out.slice(1), i1 = 0, len1 = ref1.length; i1 < len1; i1++) {
 row = ref1[i1]
    orow = []
    for (let end = row.length, i2 = n = 0, asc = 0 <= end; asc ? i2 < end : i2 > end; n = asc ? ++i2 : --i2) {
      key = out[0][n]
      val = row[n]
      if (val.length > 0) {
        orow.push([key, val])
      }
    }
    out_out.push(_.object(orow))
  }
  return out_out
}

// TODO(phil): When does this get called?
// // export
// function parseSkipLogic(collection, value, parent_row)
//   collection.meta.set("rawValue", value)
//   try
//     parsedValues = $skipLogicParser(value)
//     collection.reset()
//     collection.parseable = true
//     for crit in parsedValues.criteria
//       opts = {
//         name: crit.name
//         expressionCode: crit.operator
//       }
//       if crit.operator is "multiplechoice_selected"
//         opts.criterionOption = collection.getSurvey().findRowByName(crit.name).getList().options.get(crit.response_value)
//       else
//         criterion = crit.response_value
//       collection.add(opts, silent: true, _parent: parent_row)
//     if parsedValues.operator
//       collection.meta.set("delimSelect", parsedValues.operator.toLowerCase())
//       return
//   catch e
//     collection.parseable = false
//     return

const parseHelper = { parseSkipLogic }

const utils = (function() {

  // utils :=
  //   skipLogicParser: $skipLogicParser
  //   validationLogicParser: $validationLogicParser

  // utils.split_paste

  utils.parseHelper = {
    parseSkipLogic: function(collection, value, parent_row) {},
  }

  utils.sluggifyLabel = function(str, other_names=[]){
    return utils.sluggify(str, {
        preventDuplicates: other_names,
        lowerCase: false,
        preventDuplicateUnderscores: true,
        stripSpaces: true,
        lrstrip: true,
        incrementorPadding: 3,
        validXmlTag: true,
      })
  }

  utils.isValidXmlTag = function(str){
    return str.search(/^[a-zA-Z_:]([a-zA-Z0-9_:.])*$/) === 0
  }

  utils.sluggify = function(str, opts={}){
    var regex
    if (str === '') {
      return ''
    }
    // Convert text to a friendly format. Rules are passed as options
    opts = _.defaults(opts, {
        // l/r strip: strip spaces from begin/end of string
        lrstrip: false,
        lstrip: false,
        rstrip: false,
        // descriptor: used in error messages
        descriptor: 'slug',
        lowerCase: true,
        replaceNonWordCharacters: true,
        nonWordCharsExceptions: false,
        preventDuplicateUnderscores: false,
        validXmlTag: false,
        underscores: true,
        characterLimit: 30,
        // preventDuplicates: an array with a list of values that should be avoided
        preventDuplicates: false,
        incrementorPadding: false,
      })

    if (opts.lrstrip) {
      opts.lstrip = true
      opts.rstrip = true
    }

    if (opts.lstrip) {
      str = str.replace(/^\s+/, '')
    }

    if (opts.rstrip) {
      str = str.replace(/\s+$/, '')
    }

    if (opts.lowerCase) {
      str = str.toLowerCase()
    }

    if (opts.underscores) {
      str = str.replace(/\s/g, '_').replace(/[_]+/g, '_')
    }

    if (opts.replaceNonWordCharacters) {
      if (opts.nonWordCharsExceptions) {
        regex = /\W^[#{opts.nonWordCharsExceptions}]/g
      } else {
        regex = /\W+/g
      }
      str = str.replace(regex, '_')
      // possibly a bit specific, but removes an underscore from the end
      // of the string
      if (str.match(/._$/)) {
        str = str.replace(/_$/, '')
      }
    }

    if (_.isNumber(opts.characterLimit)) {
      str = str.slice(0, opts.characterLimit)
    }

    if (opts.validXmlTag) {
      if (str[0].match(/^\d/)) {
        str = '_' + str
      }
    }

    if (opts.preventDuplicateUnderscores) {
      while (str.search(/__/) !== -1) {
        str = str.replace(/__/, '_')
      }
    }

    if (_.isArray(opts.preventDuplicates)) {
      str = (function() {
        var names_lc, attempt_base, attempt, increment, increment_str
        names_lc = (() => { var name; const results=[]; for (let ref2 = opts.preventDuplicates, i3 = 0, len2 = ref2.length; i3 < len2; i3++) { name = ref2[i3]; if (!name) continue; results.push(name.toLowerCase()) } return results })()
        attempt_base = str

        if (attempt_base.length === 0) {
          throw new Error(`Renaming Error: ${opts.descriptor} is empty`)
        }

        attempt = attempt_base
        increment = 0
        while (indexOf.call(names_lc, attempt.toLowerCase()) >= 0) {
          increment++
          increment_str = `${increment}`
          if (opts.incrementorPadding && increment < Math.pow(10, opts.incrementorPadding)) {
            increment_str = ('000000000000' + increment).slice(-1 * opts.incrementorPadding)
          }
          attempt = `${attempt_base}_${increment_str}`
        }
        return attempt
      })()
    }

    return str
  }

  return utils
})()

export default utils
