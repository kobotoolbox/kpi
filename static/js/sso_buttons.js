// Polish: Make SSO buttons act like real buttons
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && e.target.classList.contains('kobo-button--sso')) {
    e.target.click()
  }
})
