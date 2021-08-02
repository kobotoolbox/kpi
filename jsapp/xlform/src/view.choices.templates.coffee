module.exports = do ->

  addOptionButton = () ->
      """<div class="card__addoptions js-card-add-options">
          <div class="card__addoptions__layer"></div>
            <ul><li class="multioptions__option  xlf-option-view xlf-option-view--depr">
              <div><div tabIndex="0" class="editable-wrapper"><span class="editable editable-click">+ #{t("Click to add another response...")}</span></div><code><label>#{t("XML value:")}</label> <span>#{t("AUTOMATIC")}</span></code></div>
            </li></ul>
        </div>"""

  addOptionButton: addOptionButton
