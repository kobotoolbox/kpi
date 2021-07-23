_ = require 'underscore'
Validator = require './view.utils.validator'

module.exports = do ->
  viewUtils = {}
  viewUtils.Validator = Validator

  # replaces characters that jQuery can't handle in event name
  viewUtils.normalizeEventName = (eventName) ->
    regex = new RegExp('[: ()]', 'g')
    eventName = eventName.replace(regex, '-');
    return eventName

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
          <i class="k-spin k-icon k-icon-spinner"></i>
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
