module.exports = do ->
  _t = require('utils').t

  addOptionButton = () ->
      """<div class="card__addoptions">
          <div class="card__addoptions__layer"></div>
            <ul><li class="multioptions__option  xlf-option-view xlf-option-view--depr">
              <div><div tabIndex="0" class="editable-wrapper"><span class="editable editable-click">+ #{_t("Click to add another response...")}</span></div><code><label>#{_t("XML value:")}</label> <span>#{_t("AUTOMATIC")}</span></code></div>
            </li></ul>
        </div>"""

  addOptionButton: addOptionButton
