describe('Debug', () => {
  it('should pass', () => {
    cy.visit('http://magicznyleszek.xyz/');
    cy.get('h2').should('contain', 'My online presence:');
  });
});
