Cypress.Commands.add('setupDatabase', () => {
  cy.log('setupDatabase not functional')
})

Cypress.Commands.add('login', (account, name) => {
  cy.visit('/accounts/login/')
  cy.get('#id_login').type(name)
  cy.get('#id_password').type(account.password)
  cy.contains('Login').click()
})

// Makes this case insensitive by default
Cypress.Commands.overwrite('contains',
  (originalFn, subject, filter, text, options = {}) => {
    // determine if a filter argument was passed
    if (typeof text === 'object') {
      options = text
      text = filter
      filter = undefined
    }

    options.matchCase ??= false

    return originalFn(subject, filter, text, options)
  }
)
