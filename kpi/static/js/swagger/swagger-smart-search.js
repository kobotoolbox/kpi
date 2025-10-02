window.onload = () => {
  const interval = setInterval(() => {
    const oldInput = document.querySelector('.operation-filter-input')
    const tags = document.querySelectorAll('.opblock-tag-section')
    const params = new URLSearchParams(window.location.search)
    if (!oldInput || tags.length === 0) return

    clearInterval(interval)

    const newInput = oldInput.cloneNode(true)
    oldInput.replaceWith(newInput)
    newInput.placeholder = 'Filter by tag, summary, or path'

    const filter_query = params.get('q')
    if (filter_query && filter_query.trim() !== '') {
      newInput.value = filter_query
      doSearch(filter_query.toLowerCase(), tags)
    }

    newInput.addEventListener('input', () => {
      const query = newInput.value.toLowerCase()
      doSearch(query, tags)
    })
  }, 200)
}

function doSearch(query, tags) {
  // When tags are collapsed, their content is not in the DOM and we cannot search
  // for keywords.
  if (query !== '') {
    expandAllTags()
  } else {
    collapseAllTags()
  }

  const endpointsInterval = setInterval(() => {
    const endpoints = document.querySelectorAll('.opblock-tag')
    if (endpoints.length === 0) return

    clearInterval(endpointsInterval)

    tags.forEach((tag) => {
      let showTag = !query
      const operations = tag.querySelectorAll('.opblock')

      operations.forEach((op) => {
        const summary = op.querySelector('.opblock-summary-description')?.textContent.toLowerCase() || ''
        const path = op.querySelector('.opblock-summary-path')?.textContent.toLowerCase() || ''
        const tagName = tag.querySelector('.opblock-tag')?.textContent.toLowerCase() || ''
        const match = summary.includes(query) || path.includes(query) || tagName.includes(query)

        op.style.display = match ? '' : 'none'
        if (match) showTag = true
      })

      tag.style.display = showTag ? '' : 'none'
    })
  })
}


function expandAllTags() {
  document.querySelectorAll('#swagger-ui .opblock-tag').forEach((btn) => {
    const section = btn.closest('.opblock-tag-section')
    if (section && !section.classList.contains('is-open')) btn.click()
  })
}

function collapseAllTags() {
  document.querySelectorAll('#swagger-ui .opblock-tag').forEach((btn) => {
    const section = btn.closest('.opblock-tag-section')
    if (section && section.classList.contains('is-open')) btn.click()
  })
}
