module.exports = do ->
  (that) ->
    """
    <code>#{that.model.key}:</code>
    <code>#{that.model.get("value")}</code>
    """
