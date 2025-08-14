module.exports = do ->
  return (that) ->
    template = """
    <code>#{that.model.key}:</code>
    <code>#{that.model.get("value")}</code>
    """
    return template
