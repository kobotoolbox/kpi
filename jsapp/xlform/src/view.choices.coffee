_ = require 'underscore'
Backbone = require 'backbone'
$choices = require './model.choices'
$modelUtils = require './model.utils'
$baseView = require './view.pluggedIn.backboneView'
$viewTemplates = require './view.templates'
$viewUtils = require './view.utils'

module.exports = do ->
  class ListView extends $baseView
    initialize: ({@rowView, @model})->
      @list = @model
      @row = @rowView.model
      $($.parseHTML $viewTemplates.row.selectQuestionExpansion()).insertAfter @rowView.$('.card__header')
      @$el = @rowView.$(".list-view")
      @ulClasses = @$("ul").prop("className")

    render: (isSortableDisabled) ->
      cardText = @rowView.$el.find('.card__text')
      if cardText.find('.card__buttons__multioptions.js-expand-multioptions').length is 0
        cardText.prepend $.parseHTML($viewTemplates.row.expandChoiceList())
      @$el.html (@ul = $("<ul>", class: @ulClasses))
      if @row.get("type").get("rowType").specifyChoice
        for option, i in @model.options.models
          new OptionView(model: option, cl: @model).render().$el.appendTo @ul
        if i == 0
          while i < 2
            @addEmptyOption("Option #{++i}")

        @$el.removeClass("hidden")
      else
        @$el.addClass("hidden")

      # sortable is usually enabled, but sometimes (e.g. locking restriction
      # enabled) it is not
      if not isSortableDisabled
        @ul.sortable({
            axis: "y"
            cursor: "move"
            distance: 5
            items: "> li"
            placeholder: "option-placeholder"
            opacity: 0.9
            scroll: false
            create: =>
              @ul.addClass('js-sortable-enabled')
              return
            deactivate: =>
              if @hasReordered
                @reordered()
                @model.getSurvey()?.trigger('change')
              true
            change: => @hasReordered = true
          })

      btn = $($viewTemplates.$$render('xlfListView.addOptionButton'))
      btn.click(() =>
        i = @model.options.length
        @addEmptyOption("Option #{i+1}")
        @model.getSurvey()?.trigger('change')
        @$el.children().eq(0).children().eq(i).find('input.option-view-input').select()
      )

      @$el.append(btn)
      return @

    addEmptyOption: (label)->
      emptyOpt = new $choices.Option(label: label)
      @model.options.add(emptyOpt)
      new OptionView(model: emptyOpt, cl: @model).render().$el.appendTo @ul
      lis = @ul.find('li')
      if lis.length == 2
        lis.find('.js-remove-option').removeClass('hidden')

    reordered: (evt, ui)->
      ids = []
      @ul.find("> li").each (i,li)=>
        lid = $(li).data("optionId")
        if lid
          ids.push lid
      for id, n in ids
        @model.options.get(id).set("order", n, silent: true)
      @model.options.comparator = "order"
      @model.options.sort()
      @hasReordered = false

  class OptionView extends $baseView
    tagName: "li"
    className: "multioptions__option xlf-option-view xlf-option-view--depr"
    events:
      "keyup input": "keyupinput"
      "keydown input": "keydowninput"
      "click .js-remove-option": "remove"
    initialize: (@options)->
    render: ->
      @t = $("<i class=\"k-icon k-icon-trash js-remove-option\">")
      @pw = $("<div class=\"editable-wrapper js-option-label-input js-cancel-select-row\">")
      @p = $("<input placeholder=\"#{t("This option has no name")}\" class=\"js-cancel-select-row option-view-input\">")
      @c = $("<code><label>#{t("XML value:")}</label> <input type=\"text\" class=\"js-option-name-input js-cancel-select-row\"></input></code>")
      @d = $('<div>')
      if @model
        @p.val @model.get("label") || 'Empty'
        @$el.attr("data-option-id", @model.cid)
        $('input', @c).val @model.get("name") || 'AUTOMATIC'
        @model.set('setManually', true)
      else
        @model = new $choices.Option()
        @options.cl.options.add(@model)
        @p.val("Option #{1+@options.i}").addClass("preliminary")

      @p.change ((input)->
        nval = input.currentTarget.value
        @saveValue(nval)
      ).bind @

      @n = $('input', @c)
      @n.change ((input)->
        val = input.currentTarget.value
        other_names = @options.cl.getNames()
        if @model.get('name')? && val.toLowerCase() == @model.get('name').toLowerCase()
          other_names.splice _.indexOf(other_names, @model.get('name')), 1
        if val is ''
          @model.unset('name')
          @model.set('setManually', false)
          val = 'AUTOMATIC'
          @$el.trigger("choice-list-update", @options.cl.cid)
        else
          val = $modelUtils.sluggify(val, {
                    preventDuplicates: other_names
                    lowerCase: false
                    lrstrip: true
                    incrementorPadding: false
                    characterLimit: 40
                    validXmlTag: false
                    nonWordCharsExceptions: '+-.'
                  })
          @model.set('name', val)
          @model.set('setManually', true)
          @$el.trigger("choice-list-update", @options.cl.cid)
        newValue: val
      ).bind @
      @pw.html(@p)

      @pw.on 'click', (event) =>
        if !@p.is(':hidden') && event.target != @p[0]
          @p.click()

      @d.append(@pw)
      @d.append(@t)
      @d.append(@c)
      @$el.html(@d)
      @
    keyupinput: (evt)->
      ifield = @$("input.inplace_field")
      if evt.keyCode is 8 and ifield.hasClass("empty")
        ifield.blur()

      if ifield.val() is ""
        ifield.addClass("empty")
      else
        ifield.removeClass("empty")

    keydowninput: (evt) ->
      if evt.keyCode is 13
        evt.preventDefault()

        localListViewIndex = $('ul.ui-sortable').index($(this.el).parent())
        localOptionView = $('ul.ui-sortable').eq(localListViewIndex).children().find('input.option-view-input')
        index = localOptionView.index(document.activeElement) + 1

        if index >= localOptionView.length
          $(this.el).parent().siblings().find('div.editable-wrapper').eq(0).focus()

        localOptionView.eq(index).select()

    remove: ()->
      $parent = @$el.parent()

      @model.getSurvey()?.trigger('change')

      @$el.remove()
      @model.destroy()

      lis = $parent.find('li')
      if lis.length == 1
        lis.find('.js-remove-option').addClass('hidden')

    saveValue: (nval)->
      # if new value has no non-space characters, it is invalid
      unless "#{nval}".match /\S/
        nval = false

      if nval
        nval = nval.replace /\t/g, ' '
        @model.set("label", nval, silent: true)
        other_names = @options.cl.getNames()
        if !@model.get('setManually')
          sluggifyOpts =
            preventDuplicates: other_names
            lowerCase: false
            stripSpaces: true
            lrstrip: true
            incrementorPadding: 3
            validXmlTag: true
          @model.set("name", $modelUtils.sluggify(nval, sluggifyOpts))
        @$el.trigger("choice-list-update", @options.cl.cid)
        @model.getSurvey()?.trigger('change')
        return
      else
        return newValue: @model.get "label"

  ListView: ListView
  OptionView: OptionView
