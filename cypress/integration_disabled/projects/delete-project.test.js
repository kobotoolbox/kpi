describe('Delete project', () => {
  it('should delete existing project with a button and modal', () => {
    const assetName = 'Pterodactyl feathers';

    cy.flushDatabase();
    cy.loginByInterface();
    cy.createAsset(assetName);

    cy.visit('/');
    cy.get('.asset-list').contains(assetName);

    cy.get('.asset-items--2 > :nth-child(2)').contains(assetName);
    cy.get('.asset-items--2 > :nth-child(2) > .asset-row__buttons > .popover-menu > .popover-menu__toggle').click({force: true});
    cy.get('.asset-items--2 > :nth-child(2) > .asset-row__buttons > .popover-menu > .popover-menu__content > .popover-menu__link--delete').click({force: true});
    cy.get('.ajs-ok').click();

    cy.get('.asset-list').contains(assetName).should('not.exist');
  });
});
