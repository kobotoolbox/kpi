

describe('Delete Project.', function () {

  before(() => {
    cy.fixture('accounts').then((accounts) => {
      return accounts.project_deleter
    }).then(($acct) => {
      cy.login($acct, "project_deleter")
    })
  })

  it('Cancels deleting a project', function () {

    cy.get('[data-cy="buttons"]')
      .invoke('attr', 'style', 'visibility: visible;')
      .then(() => {
        cy.get('[data-tip="More actions"]')
          .should('exist')
          .click()
      })
    
    cy.get('a[data-action="delete"]')
      .should('exist')
      .click()

    cy.get('[data-cy="checkbox"]')
    .each(($box, index) => {
      cy.wrap($box)
        .click()
    }).then(() => 
      cy.get('[data-cy="delete"]')
        .click()
    )

    // Assert -- should see a confirmation
    cy.contains("project deleted permanently", {timeout: 2000}).should('exist')
  })
})
