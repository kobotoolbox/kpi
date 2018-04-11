module.exports = do ->
  # The Csv class is only internally accessible, though easy
  # to instantiate through the `csv` function.
  #
  # It receives a parameter (and optional options) which
  # are stored for later use.
  class Csv
    constructor: (param, opts={})->
      if _isString param
        @string = param
        rows = csv.toArray @string
        @rows = arrayToObjects rows
        [@columns, @rowArray...] = rows
      else if _isArray param
        @rows = param
        @columns = do =>
          columns = []
          for row in @rows
            columns.push key  for own key of row when key not in columns
          columns
        @buildRowArray()
        @obj = param
      else if param
        @columns  = if _isArray param.columns then param.columns else []
        if param.rowObjects
          if @columns.length is 0
            # this may be slow, but it should get all the possible columns
            for row in param.rowObjects
              for key, val of row when key not of columns
                @columns.push key
          @rowArray = do =>
            for row in param.rowObjects
              row[c] for c in @columns
        else
          @rowArray = if _isArray param.rows then param.rows else []
        @kind     = param.kind if param.kind?
        @rows = do =>
          for row in @rowArray
            rowObj = {}
            for cell, i in row  when @columns[i]?
              rowObj[@columns[i]] = cell
            rowObj
      else
        @rows     = []
        @columns  = []
        @rowArray = []

    buildRowArray: ()->
      @rowArray = do =>
        for row in @rows
          for column in @columns
            row[column] || ""

    addRow: (r)->
      colsChanged = false
      for own key, val of r
        unless key in @columns
          colsChanged = true
          @columns.push key
      @rows.push r
      if colsChanged
        @buildRowArray()
      else
        @rowArray.push (r[column] for column in @columns)
      r

    toObjects: (opts={})->
      if @string
        return csv.toObjects @string, opts
      else if @rows
        @rows

    toObject: ()->
      out =
        columns: @columns
        rows: @rowArray
      out.kind = @kind  if @kind
      out

    toArrays: ()->
      out = [@columns]
      out.push row  for row in @rowArray when row.length > 0
      out

    toString: ()->
      headRow = (asCsvCellValue cell for cell in @columns).join(csv.settings.delimiter)
      headRow + "\n" + (for row in @rowArray
        (asCsvCellValue cell for cell in row).join csv.settings.delimiter).join("\n")

  csv = (param, opts)->
    if param instanceof Csv then param else new Csv param, opts

  _remove_extra_escape_chars = (ss)->
    ss.replace(/\\\\/g, '\\')

  asCsvCellValue = (cell)->
    if cell is undefined
      ""
    else if ///\W|\w|#{csv.settings.delimiter}///.test cell
      outstr = JSON.stringify("" + cell)
      _remove_extra_escape_chars outstr
    else
      cell

  csv.fromStringArray = (outpArr, opts={})->
    outArr = for row in outpArr
      (asCsvCellValue cell for cell in row).join csv.settings.delimiter
    outArr.join "\n"

  csv.fromArray = (arr, opts={})->
    sort        = !!opts.sort
    headRow     = []
    for row in arr
      headRow.push key  for own key of row when -1 is headRow.indexOf key
    headRow.sort()  if sort
    outpArr = for row in arr
      asCsvCellValue row[col]  for col in headRow
    outpArr.unshift (asCsvCellValue col  for col in headRow)
    csv.fromStringArray outpArr, opts

  csv.toObjects = (csvString)->
    arrayToObjects csv.toArray csvString

  arrayToObjects = (arr)->
    [headRow, rows...] = arr
    for row in rows when !(row.length is 1 and row[0] is "")
      obj = {}
      for key, i in headRow
        obj[key] = row[i]
      obj

  csv.toObject = (csvString, opts)->
    arrayToObject csv.toArray(csvString), opts

  arrayToObject = (arr, opts={})->
    [headRow, rows...] = arr

    sortByKey         = opts.sortByKey
    includeSortByKey  = opts.includeSortByKey

    unless sortByKey
      sortByKey = headRow[0]

    sortByKeyI = headRow.indexOf sortByKey

    out = {}
    for row in rows when !(row.length is 1 and row[0] is "")
      obj = {}
      sbKeyVal = row[sortByKeyI]
      obj[key] = row[i]  for key, i in headRow when i isnt sortByKeyI
      obj[sortByKey] = sbKeyVal  if includeSortByKey
      out[sbKeyVal] = obj
    out

  removeTrailingNewlines = (str)-> str.replace(/(\n+)$/g, "")

  csv._parse_string = (c)->
    JSON.parse('"' + c.replace(/\\/g, '\\\\').replace(/\\\\"/g, '\\"') + '"')

  # The `csv.toArray` function, pulled from this [stackoverflow comment](http://stackoverflow.com/questions/1293147/javascript-code-to-parse-csv-data)
  # will parse a delimited string into an array of
  # arrays. The default delimiter is the comma, but this
  # can be overriden in the second argument.

  csv.toArray = (strData) ->
    if csv.settings.removeTrailingNewlines
      strData = removeTrailingNewlines(strData)
    strDelimiter = csv.settings.delimiter

    rows = []
    row = []

    # The `objPattern` regular expression pulls out
    #
    # * Delimiters
    # * quoted fields
    # * and standard fields

    ###
    this regexp needs to be compiled with coffee-script 1.6.3
    or, escape characters need to be escaped (see csv._objPattern
    below this comment)

    csv._objPattern = ///
      (
        \ #{strDelimiter}
        |
        \r?\n
        |
        \r
        |
        ^
      )
      (?:
        "(
          (?:
            (?:
              [^\\]
              |
              \\\\
              |
              [\\(?=")]"
              |
              [\\(?!")]
            )*?
          )
        )"
        # > a simpler version that fails
        # > when cell ends with a backslash:
        # "(
        #   (?:
        #     \\"
        #     |
        #     [^"]
        #   )*
        # )"
        |
        (
          [^"\ #{strDelimiter}\r\n]*
        )
      )
    ///gi
    ###

    csv._objPattern = `new RegExp('(\\,|\\r?\\n|\\r|^)(?:"((?:(?:[^\\\\]|\\\\\\\\|[\\\\(?=")]"|[\\\\(?!")])*?))"|([^"\\,\\r\\n]*))', 'gi')`

    while arrMatches = csv._objPattern.exec(strData)
      strMatchedDelimiter = arrMatches[1]

      if strMatchedDelimiter.length and (strMatchedDelimiter isnt strDelimiter)
        rows.push row
        row = []

      if arrMatches[2]
        # cell is wrapped in quotes
        strMatchedValue = csv._parse_string(arrMatches[2])
      else
        # cell is not wrapped in quotes
        strMatchedValue = arrMatches[3]

      if csv.settings.parseFloat and !isNaN (parsedMatch = parseFloat strMatchedValue)
        strMatchedValue = parsedMatch

      row.push strMatchedValue
    rows.push row
    rows


  #### Sheeted CSVs
  #
  # A "sheeted csv" is a [made-up] term for a csv where value in the
  # first column corresponds to the "sheet name" and any remaining columns
  # are treated as contents of that sheet.
  #
  # *coffeescript example:*
  #
  #      sheetedCsv = """
  #        survey
  #        ,label,type
  #        ,Name:,text
  #        ,Favorite color:,select_one colors
  #        choices,,
  #        ,list,label
  #        ,colors,Black
  #        ,colors,White
  #        settings,col1,col2
  #        ,setting1,true
  #        ,setting2,false
  #      """

  class SheetedCsv
    constructor: (param, opts)->
      @_sheetIds = []
      @_sheets = {}
      if _isString param
        parseSheetedCsv param, (osids, sheets)=>
          for id in osids
            [columns, rows...] = sheets[id]
            @sheet id, csv columns: columns, rows: rows

    sheet: (sheetId, contents=false)->
      if contents
        unless sheetId in @_sheetIds
          @_sheetIds.push sheetId
        @_sheets[sheetId] = contents
      else
        @_sheets[sheetId]
    toString: ()->
      outp = []
      delimiter = csv.settings.delimiter
      for sheetId in @_sheetIds
        sheet = @_sheets[sheetId]
        cols = sheet.columns
        rowA = sheet.rowArray
        headRowStr = asCsvCellValue sheetId
        headRowStr += delimiter  for i in [0...cols.length]
        outp.push headRowStr
        outp.push delimiter + (asCsvCellValue col for col in cols).join delimiter
        for row in rowA
          outp.push delimiter + (asCsvCellValue cell for cell in row).join delimiter
      outp.join("\n")

  csv.sheeted = (param, opts)->
    if param instanceof SheetedCsv then param else new SheetedCsv param, opts

  # typically, most rows of a sheeted csv begin with an empty cell.
  #
  # *Note: When a sheet id is repeated, the contents are appended to the original sheet*

  parseSheetedCsv = (shcsv, cb=false)->
    sheets = {}
    orderedSheetIds = []

    for [cell1, remaining...] in csv.toArray shcsv
      if cell1
        curSheet = cell1

      unless curSheet
        throw new Error """
          Sheet id must be defined in the first column and cannot be falsey
          """

      unless curSheet in orderedSheetIds
        orderedSheetIds.push curSheet

      unless sheets[curSheet]
        sheets[curSheet] = []

      lineHasContent = do ->
        return true  for item in remaining when item

      sheets[curSheet].push remaining  if lineHasContent

    unless cb
      return [orderedSheetIds, sheets]

    cb.apply @, [orderedSheetIds, sheets]

  # The function `csv.sheeted.toObjects(sheetedCsv)`
  # takes a sheeted csv and builds sheets individually
  # as it would in `csv.toObjects`
  csv.sheeted.toObjects = (shCsv)-> parseSheetedCsv shCsv, (osids, sheets)->
    output = {}
    for sheet in osids
      output[sheet] = arrayToObjects sheets[sheet]
    output

  # The function `csv.sheeted.toArray(sheetedCsv)`
  # preserves the order of the sheets.
  csv.sheeted.toArray = (shCsv)-> parseSheetedCsv shCsv, (osids, sheets)->
    for sheet in osids
      id: sheet
      sheet: arrayToObjects sheets[sheet]


  # Misc. helper methods carried over from underscore.coffee
  _isString       = (obj) -> !!(obj is '' or (obj and obj.charCodeAt and obj.substr))
  _nativeIsArray  = Array.isArray
  _isArray        = _nativeIsArray or (obj) -> !!(obj and obj.concat and obj.unshift and not obj.callee)
  _nativeKeys     = Object.keys
  _keys           = _nativeKeys or (obj)->
    return new Array obj.length  if _isArray(obj)
    key for key, val of obj

  csv.settings =
    delimiter: ","
    parseFloat: false
    removeTrailingNewlines: true

  csv
