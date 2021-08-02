_ = require 'underscore'
base = require './model.base'
$modelUtils = require './model.utils'

module.exports = do ->

  choices = {}

  class choices.Option extends base.BaseModel
    initialize: ->
      @unset("list name")
      @unset("list_name")
    destroy: ->
      choicelist = @list()._parent
      choicelist_cid = choicelist.cid
      survey = choicelist.collection._parent
      @collection.remove(@)
      survey.trigger('remove-option', choicelist_cid, @cid)
    list: -> @collection
    getKeys: (with_val)->
      # returns a list of columns in the xlsform.
      # if `with_val` is true, only returns columns that
      # have an associated value.
      keys = []
      for key, attribute of @attributes
        if !with_val
          keys.push(key)
        else if @get key
          keys.push(key)
      keys
    toJSON: ()->
      attributes = {}
      for key, attribute of @attributes
        attributes[key] = @get key
      attributes

  class choices.Options extends base.BaseCollection
    model: choices.Option

  class choices.ChoiceList extends base.BaseModel
    idAttribute: "name"
    constructor: (opts={}, context)->
      options = opts.options || []
      super name: opts.name, context
      @options = new choices.Options(options || [], _parent: @)
    summaryObj: ->
      @toJSON()
    getSurvey: ->
      @collection.getSurvey()

    getList: ->
      # used for cascading selects: if choiceList is connected to
      # another choiceList, pass it on.
      if @__cascadedList
        @__cascadedList
      else
        null

    _get_previous_linked_choice_list: ->
      @collection.find((cl)=> cl.getList() is @ )

    _get_last_linked_choice_list: ->
      prev = next = @
      while next = prev._get_previous_linked_choice_list()
        prev = next
      prev

    _get_first_linked_choice_list: ->
      prev = next = @
      while next = prev.getList()
        prev = next
      prev

    _has_corresponding_row: ->
      _name = @get('name')
      !!@getSurvey().rows.find((r)->
          r.get('type').get('listName') is _name
        )

    _create_corresponding_row_data: (opts={})->
      full_path = !!opts._full_path_choice_filter
      cl = @_get_first_linked_choice_list()
      prevs = []
      rows_data = []
      build_row_data = (curlist)->
        name = curlist.get 'name'
        if full_path
          _choice_filtered = prevs
        else
          _choice_filtered = _.compact([_.last(prevs)])
        {
          label: name
          type: "select_one #{name}"
          choice_filter: _choice_filtered.map((cl)->
              cl_name = cl.get('name')
              "#{cl_name}=${#{cl_name}}"
            ).join(" and ")
        }
      rows_data.push(build_row_data(cl))
      next_list = cl
      prevs.push(cl)
      while (next_list = next_list._get_previous_linked_choice_list())
        rows_data.push(build_row_data(next_list))
        prevs.push(next_list)
      rows_data

    create_corresponding_rows: (opts={})->
      rows_data = @_create_corresponding_row_data()
      survey = @getSurvey()
      _index = opts.at or 0
      for row_data in rows_data.reverse()
        survey.addRowAtIndex(row_data, _index)

    getOptionKeys: (with_val=true)->
      option_keys = []
      for option in @options.models
        for option_key in option.getKeys(with_val)
          option_keys.push(option_key)
      _.uniq(option_keys)

    finalize: ->
      # ensure that all options have names
      names = []
      for option in @options.models
        label = option.get("label")
        name = option.get("name")
        if not name
          name = $modelUtils.sluggify(label, {
            preventDuplicates: names
            lowerCase: true
            lrstrip: true
            characterLimit: 40
            incrementorPadding: false
            validXmlTag: false
          })
          option.set("name", name)
        names.push name
      return

    clone: () ->
      json = @toJSON()
      delete json.name
      return _.assign(
          new choices.ChoiceList(json),
          collection: @collection
        )

    toJSON: ()->
      @finalize()

      # Returns {name: '', options: []}
      name: @get("name")
      options: @options.invoke("toJSON")

    getNames: ()->
      names = @options.map (opt)-> opt.get("name")
      _.compact names

  class choices.ChoiceLists extends base.BaseCollection
    model: choices.ChoiceList
    create: ->
      @add(cl = new choices.ChoiceList(name: $modelUtils.txtid()))
      cl
    getListNames: ->
      @invoke('get', 'name')
    summaryObj: (shorter=false)->
      out = {}
      for model in @models
        if shorter
          out[model.get("name")] = model.summaryObj().options
        else
          out[model.get("name")] = model.summaryObj()
      out

  choices
