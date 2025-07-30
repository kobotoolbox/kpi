_ = require 'underscore'
Backbone = require('backbone')

module.exports = do ->
  viewWidgets = {}

  class viewWidgets.Base extends Backbone.View
    attach_to: ($el) ->
      if $el instanceof viewWidgets.Base
        $el = $el.$el
      return $el.append(@el)

    bind_event: (type, callback) ->
      @$el.off type, callback
      return @$el.on type, callback
    detach: () ->
      return @$el.remove()
    val: (value) ->
      if value
        @$el.val value
        if !@$el.val()?
          return @$el.prop('selectedIndex', 0)
      else return @$el.val()

  class viewWidgets.Label extends viewWidgets.Base
    tagName: 'label'
    constructor: (text, className, input) ->
      super()
      @text = text
      @className = className
      @input = input
    val: () ->
    bind_event: () ->
    render: () ->
      if @text
        @$el.text(@text)
      if @className
        @$el.addClass @className
      if @input
        @$el.attr 'for', @input.cid
      return @

  class viewWidgets.EmptyView extends viewWidgets.Base
    constructor: () -> super()
    attach_to: () -> return
    bind_event: () -> return
    render: () -> return @
    val: () -> return null

  class viewWidgets.TextArea extends viewWidgets.Base
    tagName: 'textarea'
    render: () ->
      @$el.val @text
      @$el.addClass @className
      @$el.on 'paste', (e) -> e.stopPropagation()

      return @
    constructor: (text, className) ->
      super()
      @text = text
      @className = className

  class viewWidgets.TextBox extends viewWidgets.Base
    tagName: 'input'
    render: () ->
      @$el.attr 'type', 'text'
      @$el.val @text
      @$el.addClass @className
      @$el.attr 'placeholder', @placeholder
      @$el.on 'paste', (e) -> e.stopPropagation()

      return @
      @
    constructor: (text, className, placeholder) ->
      super()
      @text = text
      @className = className
      @placeholder = placeholder

  class viewWidgets.Button extends viewWidgets.Base
    tagName: 'button'
    render: () ->
      @$el.html @text
      @$el.addClass @className

      return @
      @
    constructor: (text, className) ->
      super()
      @text = text
      @className = className

  class viewWidgets.DropDownModel extends Backbone.Model

  class viewWidgets.DropDown extends viewWidgets.Base
    tagName: 'select'
    constructor: (options) ->
      super()
      @options = options

      if !(@options instanceof viewWidgets.DropDownModel)
        @options = new viewWidgets.DropDownModel()
        @options.set('options', options)
      @options.on 'change:options', @render.bind(@)

    render: () ->
      options_html = ''
      _.each @options.get('options'), (option) ->
        options_html += '<option value="' + option.value + '">' + option.text + '</option>'
        return

      @$el.html options_html
      return @

    attach_to: (target) ->
      super(target)
      return @$el.select2({ minimumResultsForSearch: -1 })

  return viewWidgets
