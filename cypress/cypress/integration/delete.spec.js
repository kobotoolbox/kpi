describe('Delete Project.', function () {

  before(() => {
    cy.fixture('accounts')
      .then((accounts) => accounts.project_deleter)
      .then(($acct) => {
        cy.login($acct, 'project_deleter')
      })
  })

  it('Cancels deleting a project', function () {

    // Select the project to activate the "project actions" buttons,
    // then click the 'delete' button.
    cy.get('[data-field="checkbox"] .checkbox__input')
      .should('exist')
      .click()
      .then(() => {
        cy.get('[aria-label="Delete 1 project"]')
          .should('exist')
          .click()
      })

    // Check every checkbox in the confirmation modal,
    // then click the confirmation "Delete" button
    cy.get('  .ajs-dialog [data-cy="checkbox"]')
    .each(($box) => {
      cy.wrap($box)
        .click()
    }).then(() =>
      cy.get('.ajs-dialog [data-cy="delete"]')
        .click()
    )

    // Assert -- should see a confirmation
    cy.contains('project deleted permanently', {timeout: 2000}).should('exist')
  })
})
