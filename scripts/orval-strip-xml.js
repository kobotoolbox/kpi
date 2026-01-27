/**
 * Remove XML response content only when a JSON response is also present.
 * This avoids Orval duplicate response types while keeping XML-only endpoints intact.
 */
module.exports = function transformer(spec) {
  const paths = spec?.paths || {}

  for (const pathKey of Object.keys(paths)) {
    const pathItem = paths[pathKey]
    if (!pathItem || typeof pathItem !== 'object') continue

    for (const method of Object.keys(pathItem)) {
      const op = pathItem[method]
      if (!op || typeof op !== 'object') continue

      const responses = op.responses
      if (!responses || typeof responses !== 'object') continue

      for (const status of Object.keys(responses)) {
        const res = responses[status]
        if (!res || typeof res !== 'object') continue

        const content = res.content
        if (!content || typeof content !== 'object') continue

        // Detect JSON response (covers application/json and vendor +json types)
        const hasJson = Object.keys(content).some(
          type => type === 'application/json' || type.endsWith('+json')
        )

        if (!hasJson) continue

        // Remove XML only if JSON is present
        ;['application/xml', 'text/xml'].forEach(contentType => {
          if (content[contentType]) delete content[contentType]
        })
      }
    }
  }

  return spec
}
