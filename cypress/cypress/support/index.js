import './commands'

before(() => { // run once before all tests
  cy.setupDatabase()
})

afterEach(() => { // run after every test
  cy.log('Test complete.')
})
