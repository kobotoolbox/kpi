_ = require 'underscore'
$skipLogicParser = require './model.skipLogicParser'
$validationLogicParser = require './model.validationLogicParser'

module.exports = do ->

  utils =
    skipLogicParser: $skipLogicParser
    validationLogicParser: $validationLogicParser

  _trim = (str)->
    str.replace(/^[\s\t\uFEFF\xA0]+|[\s\t\uFEFF\xA0]+$/g, '')

  utils.split_paste = (str)->
    out = []
    for row in str.split('\n')
      trimmed = _trim(row)
      unless trimmed.match(/^\s*$/)
        out.push(trimmed.split(/\t/))
    out_out = []
    for row in out[1..]
      orow = []
      for n in [0...row.length]
        key = out[0][n]
        val = row[n]
        if val.length > 0
          orow.push([key, val])
      out_out.push(_.object(orow))
    out_out

  utils.txtid = ()->
    # a is text
    # b is numeric or text
    # c is mishmash
    o = 'AAnCAnn'.replace /[AaCn]/g, (c)->
      randChar= ()->
        charI = Math.floor(Math.random()*52)
        charI += (if charI <= 25 then 65 else 71)
        String.fromCharCode charI

      r = Math.random()
      if c is 'a'
        randChar()
      else if c is 'A'
        String.fromCharCode 65+(r*26|0)
      else if c is 'C'
        newI = Math.floor(r*62)
        if newI > 52 then (newI - 52) else randChar()
      else if c is 'n'
        Math.floor(r*10)
    o.toLowerCase()

  utils.parseHelper =
    parseSkipLogic: (collection, value, parent_row) ->
      collection.meta.set("rawValue", value)
      try
        parsedValues = $skipLogicParser(value)
        collection.reset()
        collection.parseable = true
        for crit in parsedValues.criteria
          opts = {
            name: crit.name
            expressionCode: crit.operator
          }
          if crit.operator is "multiplechoice_selected"
            opts.criterionOption = collection.getSurvey().findRowByName(crit.name).getList().options.get(crit.response_value)
          else
            opts.criterion = crit.response_value
          collection.add(opts, silent: true, _parent: parent_row)
        if parsedValues.operator
          collection.meta.set("delimSelect", parsedValues.operator.toLowerCase())
        ``
      catch e
        collection.parseable = false

  utils.sluggifyLabel = (str, other_names=[])->
    utils.sluggify(str, {
        preventDuplicates: other_names
        lowerCase: false
        preventDuplicateUnderscores: true
        stripSpaces: true
        lrstrip: true
        incrementorPadding: 3
        validXmlTag: true
      })

  utils.isValidXmlTag = (str)->
    str.search(/^[a-zA-Z_:]([a-zA-Z0-9_:.])*$/) is 0

  utils.sluggify = (str, opts={})->
    if str == ''
      return ''
    # Convert text to a friendly format. Rules are passed as options
    opts = _.defaults(opts, {
        # l/r strip: strip spaces from begin/end of string
        lrstrip: false
        lstrip: false
        rstrip: false
        # descriptor: used in error messages
        descriptor: "slug"
        lowerCase: true
        replaceNonWordCharacters: true
        nonWordCharsExceptions: false
        preventDuplicateUnderscores: false
        validXmlTag: false
        underscores: true
        characterLimit: 30
        # preventDuplicates: an array with a list of values that should be avoided
        preventDuplicates: false
        incrementorPadding: false
      })

    if opts.lrstrip
      opts.lstrip = true
      opts.rstrip = true

    if opts.lstrip
      str = str.replace(/^\s+/, "")

    if opts.rstrip
      str = str.replace(/\s+$/, "")

    if opts.lowerCase
      str = str.toLowerCase()

    if opts.underscores
      str = str.replace(/\s/g, "_").replace(/[_]+/g, "_")

    if opts.replaceNonWordCharacters
      if opts.nonWordCharsExceptions
        regex = ///\W^[#{opts.nonWordCharsExceptions}]///g
      else
        regex = /\W+/g
      str = str.replace(regex, '_')
      # possibly a bit specific, but removes an underscore from the end
      # of the string
      if str.match(/._$/)
        str = str.replace(/_$/, '')

    if _.isNumber opts.characterLimit
      str = str.slice(0, opts.characterLimit)

    if opts.validXmlTag
      if str[0].match(/^\d/)
        str = "_" + str

    if opts.preventDuplicateUnderscores
      while str.search(/__/) isnt -1
        str = str.replace(/__/, '_')

    if _.isArray(opts.preventDuplicates)
      str = do ->
        names_lc = (name.toLowerCase()  for name in opts.preventDuplicates when name)
        attempt_base = str

        if attempt_base.length is 0
          throw new Error("Renaming Error: #{opts.descriptor} is empty")

        attempt = attempt_base
        increment = 0
        while attempt.toLowerCase() in names_lc
          increment++
          increment_str = "#{increment}"
          if opts.incrementorPadding and increment < Math.pow(10, opts.incrementorPadding)
            increment_str = ("000000000000" + increment).slice(-1 * opts.incrementorPadding)
          attempt = "#{attempt_base}_#{increment_str}"
        attempt

    str

  utils
