window.onload = () => {
  const interval = setInterval(() => {
    const oldInput = document.querySelector('.operation-filter-input')
    const tags = document.querySelectorAll('.opblock-tag-section')
    if (!oldInput || tags.length === 0) return

    clearInterval(interval)

    const newInput = oldInput.cloneNode(true)
    oldInput.replaceWith(newInput)
    newInput.placeholder = 'Filter by tag, summary, or path'

    newInput.addEventListener('input', () => {
      const query = newInput.value.toLowerCase()

      tags.forEach((tag) => {
        let showTag = false
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
  }, 200)
}
