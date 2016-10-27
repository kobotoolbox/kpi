###
# [inputDeserializer]
#  wrapper around methods for converting raw input into survey structure
# ______________________________________________________________________
###

_ = require 'underscore'
csv = require './csv'
$aliases = require './model.aliases'

module.exports = do ->
  inputDeserializer = (inp, ctx={})->
    r = deserialize inp, ctx
    if not ctx.error and ctx.validate
      validateParse(r, ctx)
    r

  # [inputDeserializer.deserialize] parses csv string, json string,
  #  or object into survey object
  # -------------------------------
  deserialize = do ->
    _csv_to_params = (csv_repr)->
      cobj = csv.sheeted(csv_repr)
      out = {}

      out.survey = if (sht = cobj.sheet "survey") then sht.toObjects() else []
      out.choices = if (sht = cobj.sheet "choices") then sht.toObjects() else []
      if (sht = cobj.sheet "settings")
        out.settings = sht.toObjects()[0]

      out

    _parse_sheets = (repr)->
      # If a sheet has a first-row which is an array, that array will be treated as column
      # headers and any subsequent array-rows will be matched up

      for shtName, sheet of repr
        if _.isArray(sheet) and sheet.length > 0 and _.isArray(sheet[0])
          out_sheet = []
          [cols, contents...] = sheet
          for row in contents
            if _.isArray(row)
              new_row = {}
              for col, i in cols
                if i < row.length and row[i] not in [undefined, null]
                  new_row[col] = row[i]
              out_sheet.push(new_row)
            else
              out_sheet.push(row)
          repr[shtName] = out_sheet
      repr

    # returns: function
    (repr, ctx={})->
      if _.isString(repr)
        _csv_to_params repr
      else if _.isObject repr
        _parse_sheets repr
      else
        ``

  # [inputDeserializer.validateParse]
  #  ensure correct sheet names exist in imported surveys
  # ---------------------------------
  validateParse = do ->
    requiredSheetNameList = $aliases.q.requiredSheetNameList()

    # returns: function
    (repr, ctx={})->
      valid_with_sheet = false
      for sheetId in requiredSheetNameList
        if repr[sheetId]
          ctx.surveyType = sheetId
          valid_with_sheet = true
      ctx.settings = true  if repr['settings']
      ctx.choices = true  if repr['choices']
      unless valid_with_sheet
        sn = requiredSheetNameList.join(', ')
        ctx.error = "Missing a survey sheet [#{sn}]"
      !ctx.error

  inputDeserializer.validateParse = validateParse
  inputDeserializer.deserialize = deserialize
  inputDeserializer
