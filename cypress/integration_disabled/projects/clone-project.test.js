describe('Clone project', () => {
  it('should clone existing project with a button and modal', () => {
    const assetName = 'First mammals on Earth';

    cy.flushDatabase();
    cy.loginByInterface();
    cy.createAsset(assetName);

    cy.visit('/');
    cy.get('.asset-list').contains(assetName);

    cy.get('.asset-items--2 > :nth-child(2)').contains(assetName);
    cy.get('.asset-items--2 > :nth-child(2) > .asset-row__buttons > .asset-row__action-icon--clone').click({force: true});
    cy.get('.ajs-ok').click();

    // wait for assets to reload after clone
    cy.wait(1000).then(() => {
      cy.get('.asset-list').contains(`Clone of ${assetName}`);
    });
  });
});
