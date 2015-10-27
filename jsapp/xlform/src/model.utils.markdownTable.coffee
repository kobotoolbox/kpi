csv = require './csv'

module.exports = do ->

  markdownTable = {}
  ###
  this markdownTable is not meant to be used in production for real surveys.
  It's simply here because it provides a clean way to display xlsforms in the source code.
  ###

  markdownTable.mdSurveyStructureToObject = (md)->
    _trim = (s)-> String(s).replace(/^\s+|\s+$/g, '')
    shtName = false
    curSheet = false
    sObj = {}
    _pushSheet = ->
      cols = curSheet[0]
      sheetObjs = []
      for row in curSheet.slice(1)
        rowObj = {}
        for cell, n in row when cols[n]
          rowObj[cols[n]] = cell
        sheetObjs.push(rowObj)
      sObj[shtName] = sheetObjs
      curSheet = []
    for row in md.split('\n')
      _r = []
      rcells = _trim(row).split('|')
      for cell, i in rcells when i > 0
        _r.push _trim(cell)
      if _r[0]
        _pushSheet()  if curSheet
        shtName = _r[0]
        curSheet = []
      else if curSheet
        curSheet.push(_r.slice(1, _r.length-1))
      _r
    _pushSheet()
    sObj


  markdownTable.csvJsonToMarkdown = (csvJson)->
    _lengths = []
    _record_max = (val, index)->
      if !_lengths[index]
        (_lengths[index] = 0)
      if val > _lengths[index]
        (_lengths[index] = val)
      ``
    _ljust = (str, n) ->
      (str = '')  if !str
      diff = n - str.length
      if diff > 0
        str += (new Array(diff+1)).join(' ')
      str
    _append_line_arr = (_arr, preceding=0)->
      for i in [0...preceding]
        _arr.unshift('')
      _arr.length = _lengths.length
      for x, i in _arr
        _arr[i] = _ljust(x, _lengths[i])
      outstr += "| #{_arr.join(' | ')} |\n"
      ``

    sheeted = csv.sheeted()
    outstr = "\n"

    for shtName, content of csvJson
      _record_max(shtName.length, 0)
      _sht = sheeted.sheet shtName, csv(content)
      for cell, i in content.columns
        _record_max(cell.length, i+1)
      for row in _sht.rowArray
        for cell, i in row
          _record_max(cell.length, i+1)

    for shtName, sheet of sheeted._sheets
      _append_line_arr([shtName])
      _append_line_arr(sheet.columns, 1)
      _append_line_arr(row, 1)  for row in sheet.rowArray

    outstr

  markdownTable
