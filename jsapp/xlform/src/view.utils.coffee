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
      return
    $el.appendTo(parentEl)  for $el in arr when $el
    return

  viewUtils.cleanStringify = (atts)->
    attArr = []
    for key, val of atts when val isnt ""
      attArr.push """<span class="atts"><i>#{key}</i>="<em>#{val}</em>"</span>"""
    return attArr.join("&nbsp;")

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
      return
    showFn.close = ->
      if $div
        $div.remove()
        $div = false
        return
    return showFn

  viewUtils.launchQuestionLibrary = do ->
    launch = (opts={})->
      wrap = $("<div>", class: "js-click-remove-iframe iframe-bg-shade")
      $("<div>").text("""
        Launch question library in this element
        <section koboform-question-library=""></section>
      """).appendTo(wrap)
      wrap.click ()-> wrap.remove()
      return wrap

    return launch

  # TODO: check if this is dead code, we don't seem to be using this anywhere
  viewUtils.enketoIframe = do ->
    enketoServer = "https://enketo.org"
    enketoPreviewUri = "/webform/preview"
    buildUrl = (previewUrl)->
      return """#{enketoServer}#{enketoPreviewUri}?form=#{previewUrl}"""

    _loadConfigs = (options)->
      if options.enketoPreviewUri
        enketoPreviewUri = options.enketoPreviewUri
      if options.enketoServer
        enketoServer = options.enketoServer
      return

    clickCloserBackground = ->
      return $("<div>", class: "js-click-remove-iframe")

    launch = (previewUrl, options={})->
      _loadConfigs(options)
      $(".enketo-holder").append $("<iframe>", src: buildUrl(previewUrl))
      return $(".enketo-holder iframe").load ()->
        # alert "iframe loaded yo!"
        return $(".enketo-loading-message").remove()

    launch.close = ()->
      $(".iframe-bg-shade").remove()
      return $(".enketo-holder").remove()

    launch.fromCsv = (surveyCsv, options={})->
      # Probably dead code? Can't find it being called anywhere, and the
      # endpoint it uses doesn't exist anymore. -jnm 20230207
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
        return holder.remove()

      $('.enketo-holder .enketo-iframe-icon').click ()->
        wrap.remove()
        return holder.remove()

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
            return options.onSuccess()  if options.onSuccess?
          else if status isnt "success"
            wrap.remove()
            holder.remove()
            informative_message = jqhr.responseText or jqhr.statusText
            if informative_message.split("\n").length > 0
              return informative_message = informative_message.split("\n")[0..2].join("<br>")
            return onError informative_message, title: 'Error launching preview'
          else if response and response.error
            wrap.remove()
            holder.remove()
            return onError response.error
          else
            wrap.remove()
            holder.remove()
            return onError "SurveyPreview response JSON is not recognized"
      return

    return launch

  return viewUtils
