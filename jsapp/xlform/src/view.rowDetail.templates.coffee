define 'cs!xlform/view.rowDetail.templates', [], ()->
  (that) ->
    """
    <code>#{that.model.key}:</code>
    <code>#{that.model.get("value")}</code>
    """
