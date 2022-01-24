describe('Create questions', function () {

    before(() => {
      cy.fixture('accounts').then((accounts) => {
        return accounts.question_creation
      }).then(($acct) => {
        cy.login($acct)
      })
    })
  
    it('Creates questions', function () { 
        cy.fixture('questions').then((data) => {
            cy.get('[data-cy="question"]')
                .click()
                
            cy.get('[data-cy="edit"]')
                .click()

            for (const question in data) {
                cy.log(`${question}: ${data[question]}`);

                cy.get('[data-cy="plus"]')
                    .click()

                cy.get('[data-cy="textfield_input"]')
                    .type(data[question].text)

                cy.get('[data-cy="add_question"]')
                    .click()

                cy.get('[data-menu-item="' + data[question].menu_item + '"]')
                    .click()

                if (data[question].hasOwnProperty('options')) {
                    for (var i = 0; i < data[question].options.length - 2; i++) {
                        cy.get('[data-cy="add_option"]')
                            .click()
                    }

                    cy.get('[data-cy="option"]')
                        .each(($opt, index) => {
                            cy.wrap($opt)
                                .click()
                                .then(() => 
                                    cy.wrap($opt)
                                        .clear()
                                        .type(data[question].options[index])
                                )
                        })
                }

                
            }
            cy.get('[data-cy="save"]')
                    .click()

            cy.contains('successfully updated')
                .should('exist')
        })
    })
})
