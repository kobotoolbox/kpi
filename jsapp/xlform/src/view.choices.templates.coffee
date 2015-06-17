define 'cs!xlform/view.choices.templates', [], ()->

  addOptionButton = () ->
      """<div class="card__addoptions">
          <div class="card__addoptions__layer"></div>
            <ul><li class="multioptions__option  xlf-option-view xlf-option-view--depr">
              <div><div class="editable-wrapper"><span class="editable editable-click">+ Click to add another response...</span></div><code><label>Value:</label> <span>AUTOMATIC</span></code></div>
            </li></ul>
        </div>"""

  addOptionButton: addOptionButton