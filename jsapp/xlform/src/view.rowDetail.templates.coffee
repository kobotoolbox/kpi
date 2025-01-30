export default do ->
  (that) ->
    """
    <code>#{that.model.key}:</code>
    <code>#{that.model.get("value")}</code>
    """
