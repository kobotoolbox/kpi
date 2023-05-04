// Polish: Make SSO buttons act like real buttons
document.addEventListener('keydown', function(e) {
  if ((e.code === 'Space') && e.target.classList.contains('kobo-button--sso')) {
    e.target.click()
  }
})
