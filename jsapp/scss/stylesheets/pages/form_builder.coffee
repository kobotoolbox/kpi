###
Associated with "form_builder.scss"

BEM:
block:
  "formb" #formbuilder
elems:
  "surveybuttons" # 
###

@sandbox = (el)->
  $wrap = $ $.parseHTML contents()
  # $header = $wrap.find(".survey-header").eq(0)
  # $list = $wrap.find("ul").eq(0)
  $(el).html $wrap

  $('body').on 'click', 'ul.card__settings__tabs li:not(.heading)', (evt)->
    # evt.preventDefault()
    $et = $(evt.target)
    tabId = $et.data('cardSettingsTabId')
    $et.parent('ul').find('.active').removeClass('active')
    $et.addClass('active')
    $et.parents('.card__settings').find(".card__settings__fields.active").removeClass('active')
    $et.parents('.card__settings').find(".card__settings__fields--#{tabId}").addClass('active')

  # button hover effects via JS
  $('body').on 'mouseenter', '.card__buttons .card__buttons__button', (evt)->
    $et = $(evt.target)
    bColor = $(this).data('buttonColor')
    bText = $(this).data('buttonText')
    $et.parents('.card__buttons').addClass('noborder')
    $et.parents('.card__header').append('<div class="bg">')
    $et.parents('.card__header').find('.bg').addClass("#{bColor}").html("<span>#{bText}</span>")

  $('body').on 'mouseleave', '.card__buttons .card__buttons__button', (evt)->
    $et = $(evt.target)
    $et.parents('.card__buttons').removeClass('noborder')
    $et.parents('.card__header').find('.bg').remove()

  ``

contents = ->
  ###
  the form builder is contained within a <section>
  ###
  
  # TODO: merge .-form-builder (wrap) with .form-builder (margin)
  """
  <div class="survey-header">
    SurveyHeader
  </div>
  <div class="container">
  <section class="-form-builder form-builder">
    <div class="formb__surveybuttons"></div>
    <div class="survey-editor">
      <ul>
        #{empty_survey_message()}
        #{li_row('text')}
        #{li_row('longtext')}
        #{li_row('number')}
        #{li_row('indrag')}
        #{li_row('dragplaceholder')}
      </ul>
    </div>
  </section>
  </div>
  """


CENSUS_TEXTS =
  integer: "How many people were living or staying in this house, apartment, or mobile home on April 1, 2010?",
  select1yn: "Were there any additional people staying here April 1, 2010 that you did not include in Question 1?",
  select1: "Is this house, apartment, or mobile home: owned with mortgage, owned without mortgage, rented, occupied without rent?",
  text:    "What is your telephone number?",

###
  ["integer","q1","How many people were living or staying in this house, apartment, or mobile home on April 1, 2010?"
  ,"select_one yes_no","q2","Were there any additional people staying here April 1, 2010 that you did not include in Question 1?"
  ,"select_one ownership_type or_other","q3","Is this house, apartment, or mobile home: owned with mortgage, owned without mortgage, rented, occupied without rent?"
  ,"text","q4","What is your telephone number?"
  ,"text","q5","Please provide information for each person living here. Start with a person here who owns or rents this house, apartment, or mobile home. If the owner or renter lives somewhere else, start with any adult living here. This will be Person 1. What is Person 1's name?"
  ,"select_one male_female","q6","What is Person 1's sex?"
  ,"date","q7","What is Person 1's age and Date of Birth?"

###
loremipsum = """
  Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s.
"""

li_row = (variation='text') ->
  note = """
    card preview <strong><code>:#{variation}</code></strong>
  """

  if variation is 'dragplaceholder'
    drag_placeholder_row(note: note)
  else
    standard_row(variation, note: note)

drag_placeholder_row = ({note})->
  """
  <li class="xlf-row-view">
    #{sidenote(note, 'absrt')}
    <div class="card--placeholder">
        <span>Drag and drop to reorder</span>
    </div>
  </li>
  """

standard_row = (variation='text', {note}) ->

  _text = if variation in ['text', 'indrag']
    CENSUS_TEXTS.text
  else if variation is 'longtext'
    loremipsum
  else if variation is 'number'
    CENSUS_TEXTS.integer
  else
    "<i>no text for <code>:#{variation}</code></i>"

  card__indicator = """
    <div class="card__indicator">
      <div class="noop card__indicator__icon"><i class="fa fa-list"></i></div>
    </div>
  """
  card__butons = """
    <div class="card__buttons">
      <a href="#" class="card__buttons__button card__buttons__button--settings gray js-advanced-toggle js-toggle-row-settings" data-button-color="gray" data-button-text="Settings"><i class="fa fa-cog"></i></a>
      <a href="#" class="card__buttons__button red" data-button-color="red" data-button-text="Delete Question"><i class="fa fa-trash-o"></i></a>
      <a href="#" class="card__buttons__button blue" data-button-color="blue" data-button-text="Duplicate Question"><i class="fa fa-copy"></i></a>
    </div>
  """

  """
  <li class="xlf-row-view">
    #{sidenote(note, 'absrt')}

    <div class="card card--expandedsettings">
      <div class="card__header">
        #{card__indicator}
        <div class="card__text">
          #{_text}
        </div>
        
        #{card__butons}
      </div>
      <div class="card__settings card__settings--question-options">
        <ul class="card__settings__tabs">
          <li class="heading"><i class="fa fa-cog"></i> Settings</li>
          <li class="active" data-card-settings-tab-id="question-options">Question Options</li>
          <li data-card-settings-tab-id="skip-logic">Skip Logic</li>
          <li data-card-settings-tab-id="validation-criteria">Validation Criteria</li>
          <li data-card-settings-tab-id="response-type">Response Type</li>
        </ul>
        <div class="card__settings__content clearfix">
          <ul class="card__settings__fields card__settings__fields--question-options active">
            <li class="card__settings__fields__field"><label>Question Hint: </label> <span class="settings__input"><input type="text" name="hint" class="text" /></span></li>
            <li class="card__settings__fields__field"><label>Required: </label> <span class="settings__input"><input type="checkbox" name="required"/> Yes</span></li>
            <li class="card__settings__fields__field"><label>Default: </label> <span class="settings__input"><input type="text" name="default" class="text"/></span></li>
          </ul>

          <ul class="card__settings__fields card__settings__fields--skip-logic">
            <li class="card__settings__fields__field"><button class="skiplogic__button skiplogic__select-builder"><i class="fa fa-plus"></i> Add a condition</button></li>
            <li class="card__settings__fields__field"><button class="skiplogic__button skiplogic__select-handcode"><i class="fa fa-code"></i> Manually enter your skip logic in XLSForm code</button></li>
          </ul>

          <ul class="card__settings__fields card__settings__fields--validation-criteria">
            <li class="card__settings__fields__field">Validation criteria will go here</li>
          </ul>

          <ul class="card__settings__fields card__settings__fields--response-type">
            <li class="card__settings__fields__field">Response type will go here</li>
          </ul>

        </div>
      </div>
    </div>
  </li>
  """

empty_survey_message = ->
  ###
  The empty survey message is an empty <li>
  ###
  note = """
  When the survey is empty, this is the only item shown.
  """

  """
  <li class="survey-editor__null-top-row">
    #{sidenote(note, 'absrt')}

    <p class="survey-editor__message well">
      <b>This form is currently empty.</b>
      <br>
      <a href="#">Add your first question now</a>
    </p>
  </li>
  """

sidenote = (msg, styling_variation='inline-block')->
  """
  <div class="sidenote-wrap-#{styling_variation}">
    <div class="sidenote">
      #{msg}
    </div>
  </div>
  """
