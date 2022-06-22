import './commands'

// Alternatively you can use CommonJS syntax:
// require('./commands')

before(() => { //run once before all tests
  cy.setupDatabase()
})

afterEach(() => { //run after every test
  cy.log("Test complete.")
})
