// 📘 generated from ./model.utils.markdownTable.civet 

var csv
csv = require('./csv')

module.exports = (function() {

  var markdownTable

  markdownTable = {}
  /*
  this markdownTable is not meant to be used in production for real surveys.
  It's simply here because it provides a clean way to display xlsforms in the source code.
  */

  markdownTable.mdSurveyStructureToObject = function(md){
    var _trim, shtName, curSheet, sObj, _pushSheet, row, _r, rcells, cell, i
    _trim = function(s){ return String(s).replace(/^\s+|\s+$/g, '') }
    shtName = false
    curSheet = false
    sObj = {}
    _pushSheet = function() {
      var cols, sheetObjs, rowObj, n
      cols = curSheet[0]
      sheetObjs = []
      for (let ref = curSheet.slice(1), i1 = 0, len = ref.length; i1 < len; i1++) {
 row = ref[i1]
        rowObj = {}
        for (let i2 = 0, len1 = row.length; i2 < len1; i2++) {
 cell = row[n=i2]; if (!cols[n]) continue
          rowObj[cols[n]] = cell
        }
        sheetObjs.push(rowObj)
      }
      sObj[shtName] = sheetObjs
      return curSheet = []
    }
    for (let ref1 = md.split('\n'), i3 = 0, len2 = ref1.length; i3 < len2; i3++) {
 row = ref1[i3]
      _r = []
      rcells = _trim(row).split('|')
      for (let i4 = 0, len3 = rcells.length; i4 < len3; i4++) {
 cell = rcells[i=i4]; if (!(i > 0)) continue
        _r.push(_trim(cell))
      }
      if (_r[0]) {
        if (curSheet) { _pushSheet() }
        shtName = _r[0]
        curSheet = []
      } else if (curSheet) {
        curSheet.push(_r.slice(1, _r.length-1))
      }
      _r
    }
    _pushSheet()
    return sObj
  }


  markdownTable.csvJsonToMarkdown = function(csvJson){
    var _lengths, _record_max, _ljust, _append_line_arr, sheeted, outstr, shtName, content, _sht, cell, i, row, sheet
    _lengths = []
    _record_max = function(val, index){
      if (!_lengths[index]) {
        (_lengths[index] = 0)
      }
      if (val > _lengths[index]) {
        return (_lengths[index] = val)
      } return
    }
    _ljust = function(str, n) {
      var diff
      if (!str) { (str = '') }
      diff = n - str.length
      if (diff > 0) {
        str += (new Array(diff+1)).join(' ')
      }
      return str
    }
    _append_line_arr = function(_arr, preceding=0){
      var x
      for (let i5 = i = 0, asc = 0 <= preceding; asc ? i5 < preceding : i5 > preceding; i = asc ? ++i5 : --i5) {
        _arr.unshift('')
      }
      _arr.length = _lengths.length
      for (let i6 = 0, len4 = _arr.length; i6 < len4; i6++) {
 x = _arr[i=i6]
        _arr[i] = _ljust(x, _lengths[i])
      }
      return outstr += `| ${_arr.join(' | ')} |\n`
    }

    sheeted = csv.sheeted()
    outstr = '\n'

    for (shtName in csvJson) {
 content = csvJson[shtName]
      _record_max(shtName.length, 0)
      _sht = sheeted.sheet(shtName, csv(content))
      for (let ref2 = content.columns, i7 = 0, len5 = ref2.length; i7 < len5; i7++) {
 cell = ref2[i=i7]
        _record_max(cell.length, i+1)
      }
      for (let ref3 = _sht.rowArray, i8 = 0, len6 = ref3.length; i8 < len6; i8++) {
 row = ref3[i8]
        for (let i9 = 0, len7 = row.length; i9 < len7; i9++) {
 cell = row[i=i9]
          _record_max(cell.length, i+1)
        }
      }
    }

    for (shtName in sheeted._sheets) {
 sheet = sheeted._sheets[shtName]
      _append_line_arr([shtName])
      _append_line_arr(sheet.columns, 1)
      for (let ref4 = sheet.rowArray, i10 = 0, len8 = ref4.length; i10 < len8; i10++) { row = ref4[i10]; _append_line_arr(row, 1) }
    }

    return outstr
  }

  return markdownTable
})()
