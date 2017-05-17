_ = require 'underscore'
jQuery = require 'jquery'
Validator = require './view.utils.validator'

module.exports = do ->
  viewUtils = {}
  viewUtils.Validator = Validator

  viewUtils.makeEditable = (that, model, selector, {property, transformFunction, options, edit_callback}) ->
    if !(selector instanceof jQuery)
      selector =that.$el.find(selector)

    if selector.data('madeEditable')
      console?.error "makeEditable called 2x on the same element: ", selector
    selector.data('madeEditable', true)

    if !transformFunction?
      transformFunction = (value) -> value
    if !property?
      property = 'value'

    if !edit_callback?
      edit_callback = _.bind (ent) ->
          ent = transformFunction ent
          ent = ent.replace(/\t/g, ' ')
          model.set(property, ent, validate: true)
          if(model.validationError && model.validationError[property])
            return model.validationError[property]

          newValue: ent
        , that


    selector.on 'shown', (e, obj) -> obj.input.$input.on 'paste', (e) -> e.stopPropagation()


    enable_edit = () ->
      parent_element = selector.parent()
      parent_element.find('.error-message').remove()
      current_value = selector.text().replace new RegExp(String.fromCharCode(160), 'g'), ''
      edit_box = $('<input />', type:'text', value: current_value, class:'js-cancel-sort js-blur-on-select-row')
      selector.after edit_box
      selector.hide()
      edit_box.select()

      commit_edit = () ->
        parent_element.find('.error-message').remove()
        if options? && options.validate? && options.validate(edit_box.val())?
          new_value = options.validate(edit_box.val())
        else
          new_value = edit_callback edit_box.val()

        if !new_value?
          new_value = newValue: edit_box.val()

        if new_value.newValue?
          edit_box.remove()
          selector.show()
          selector.html new_value.newValue
        else
          error_box = $('<div class="error-message">' + new_value + '</div>')
          parent_element.append(error_box)

      edit_box.blur commit_edit
      edit_box.keypress (event) ->
        if event.which == 13
          commit_edit event


    selector.on 'click', enable_edit
    #selector.editable editableOpts


  viewUtils.reorderElemsByData = (selector, parent, dataAttribute)->
    arr = []
    parentEl = false
    $(parent).find(selector).each (i)->
      if i is 0
        parentEl = @parentElement
      else if @parentElement isnt parentEl
        throw new Error("All reordered items must be siblings")

      $el = $(@).detach()
      val = $el.data(dataAttribute)
      arr[val] = $el  if _.isNumber(val)
    $el.appendTo(parentEl)  for $el in arr when $el
    return

  viewUtils.cleanStringify = (atts)->
    attArr = []
    for key, val of atts when val isnt ""
      attArr.push """<span class="atts"><i>#{key}</i>="<em>#{val}</em>"</span>"""
    attArr.join("&nbsp;")

  viewUtils.debugFrame = do ->
    $div = false
    debugFrameStyle =
      position: "fixed"
      width: "95%"
      height: "80%"
      bottom: 10
      left: "2.5%"
      overflow: "auto"
      zIndex: 100
      backgroundColor: "rgba(255,255,255,0.7)"

    showFn = (txt)->
      html = txt.split("\n").join("<br>")
      $div = $("<div>", class: "well debug-frame").html("<code>#{html}</code>")
        .css(debugFrameStyle)
        .appendTo("body")
    showFn.close = ->
      if $div
        $div.remove()
        $div = false
    showFn

  viewUtils.launchQuestionLibrary = do ->
    launch = (opts={})->
      wrap = $("<div>", class: "js-click-remove-iframe iframe-bg-shade")
      $("<div>").text("""
        Launch question library in this element
        <section koboform-question-library=""></section>
      """).appendTo(wrap)
      wrap.click ()-> wrap.remove()
      wrap

    launch

  viewUtils.enketoIframe = do ->
    enketoServer = "https://enketo.org"
    enketoPreviewUri = "/webform/preview"
    buildUrl = (previewUrl)->
      """#{enketoServer}#{enketoPreviewUri}?form=#{previewUrl}"""

    _loadConfigs = (options)->
      if options.enketoPreviewUri
        enketoPreviewUri = options.enketoPreviewUri
      if options.enketoServer
        enketoServer = options.enketoServer

    clickCloserBackground = ->
      $("<div>", class: "js-click-remove-iframe")

    launch = (previewUrl, options={})->
      _loadConfigs(options) 
      console.log options
      $(".enketo-holder").append $("<iframe>", src: buildUrl(previewUrl))
      $(".enketo-holder iframe").load ()->
        # alert "iframe loaded yo!"
        $(".enketo-loading-message").remove()

    launch.close = ()->
      $(".iframe-bg-shade").remove()
      $(".enketo-holder").remove()

    launch.fromCsv = (surveyCsv, options={})->
      holder = $("<div>", class: "enketo-holder").html("""
        <div class='enketo-iframe-icon'></div>
        <div class="enketo-loading-message">
          <p>
          <i class="fa fa-spin fa-spinner"></i>
          <br/>
          Loading Preview
        </p>
        <p>
          This will take a few seconds depending on the size of your form.
        </p>
        </div>
      """)
      wrap = $("<div>", class: "js-click-remove-iframe iframe-bg-shade")
      holder.appendTo('body')
      wrap.appendTo('body')

      wrap.click ()-> 
        wrap.remove()
        holder.remove()

      $('.enketo-holder .enketo-iframe-icon').click ()-> 
        wrap.remove()
        holder.remove()

      previewServer = options.previewServer or ""
      data = JSON.stringify(body: surveyCsv)
      _loadConfigs(options)
      onError = options.onError or (args...)-> console?.error.apply(console, args)

      $.ajax
        url: "#{previewServer}/koboform/survey_preview/"
        method: "POST"
        data: data
        complete: (jqhr, status)=>
          response = jqhr.responseJSON
          if status is "success" and response and response.unique_string
            unique_string = response.unique_string
            launch("#{previewServer}/koboform/survey_preview/#{unique_string}")
            options.onSuccess()  if options.onSuccess?
          else if status isnt "success"
            wrap.remove()
            holder.remove()
            informative_message = jqhr.responseText or jqhr.statusText
            if informative_message.split("\n").length > 0
              informative_message = informative_message.split("\n")[0..2].join("<br>")
            onError informative_message, title: 'Error launching preview'
          else if response and response.error
            wrap.remove()
            holder.remove()
            onError response.error
          else
            wrap.remove()
            holder.remove()
            onError "SurveyPreview response JSON is not recognized"

    launch

  class viewUtils.ViewComposer
    add: (view, id) ->
      @views.push view
    remove: (id) -> throw 'not implemented'
    get: (id) -> throw 'not implemented'
    render: () ->
      for view in @views
        view.render()
    attach_to: (destination) ->
      for view in @views
        view.attach_to destination
    bind_event: (event_name, callback) -> throw 'not implemented'
    constructor: () ->
      @views = []

  viewUtils
