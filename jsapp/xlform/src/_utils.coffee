
define ['./_model'], ($model)->
  ###
  ###
  utils = {}

  utils.pluckNames = (survey, options={})->
    names = []
    survey.forEachRow (r)->
      names.push r.getValue('name')
    names

  utils.summarizeSurvey = (survey, options={})->
    survey.summarize()

  utils.shrinkSurvey = (survey, options={})->
    # by the time survey.toCSV() is called, the extra choice lists have already
    # been trimmed out of the survey
    survey.toCSV()

  utils.split_into_individual_surveys = (survey, options={})->
    surveys = []
    limitRows = options.limitRows
    if !limitRows
      limitRows = -1
    else
      limitRows = +limitRows

    rowCount = 0
    fn = (r)->
      if limitRows isnt -1 and limitRows < rowCount++
        throw new Error("This file surpasses the import limit of #{limitRows} rows")
      if r.constructor.kls is "Row"
        try
          newSurvey = new $model.Survey()
          newSurvey.addRow(r)
          surveys.push [newSurvey.toCSV()]

    survey.forEachRow fn, flat: true
    surveys

  # ensure utils get wrapped for clean error messages
  wrappedUtils = {}
  for key, _fn of utils
    do(fn=_fn)->
      wrappedUtils[key] = (args...)->
        r = {}
        try
          r = fn.apply(@, args)
        catch e
          r.error = e.message
        r

  wrappedUtils
