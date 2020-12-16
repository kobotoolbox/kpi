###
TranslationList() is an object attached to each $model.Survey()
and it provides a consistent place to keep track of translations
and their corresponding columns in the survey and choices.

It will be especially useful in exporting schema-validated translated
columns.
###


fromColumnTxString = (txStr, index)->
  # fromColumnTxString
  # parses column strings like "English (en)" into an object
  mtch = txStr.match(/(.*)\s\((\w+)\)/)
  out = { index: index }
  if mtch
    out.name = mtch[1]
    out.locale = mtch[2]
    out.anchor = mtch[2]
  else
    out.name = txStr
    out.anchor = "tx#{index}"
  out

class Translation
  constructor: ({ @name, @index, @$anchor, @locale })->
    if @index is 0
      @colSuffix = ''
    else if @locale
      @colSuffix = "::#{@name} (#{@locale})"
    else
      @colSuffix = "::#{@name}"

    if (not @$anchor) and @locale
      @$anchor = @locale
    else if not @$anchor
      @$anchor = "tx#{@index}"

  toObject: ()->
    out = {
      name: @name
      $anchor: @$anchor
    }
    if @locale
      out.locale = @locale
    out

class TranslationList
  constructor: ()->
    @_map = new Map()

  get: (anchor)->
    @_map.get(anchor)

  asArray: ->
    Array.from @_map.values()

  values: ->
    @_map.values()

  forEach: (fn)->
    @_map.forEach(fn)

  loadColumnStrings: (tx0, txStrings)->
    if tx0 is undefined
      # an empty translation (still found in tests)
      @add({ index: 0, name: '' })
    else
      @add(fromColumnTxString(tx0, 0))
      txStrings.forEach (txName, index)=>
        if index > 0
          @add(fromColumnTxString(txName, index))

  add: (params)->
    tx = new Translation params
    @_map.set tx.$anchor, tx
    @anchors = Array.from(@_map.values()).map (_tx)-> _tx.$anchor
    @length = @_map.size
    tx

module.exports =
  TranslationList: TranslationList
