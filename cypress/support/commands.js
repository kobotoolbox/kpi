const DEFAULT_USERNAME = 'kobo';
const DEFAULT_PASSWORD = 'kobo';

// fast login using raw HTTP requests
Cypress.Commands.add('login', (username = DEFAULT_USERNAME, password = DEFAULT_PASSWORD) => {
  cy.request({
    method: 'GET',
    url: '/accounts/login/'
  }).then((response) => {
    const tokenName = 'csrftoken=';
    let tokenVal;
    for (let cookieVal of response.headers['set-cookie']) {
      if (cookieVal.startsWith(tokenName)) {
        tokenVal = cookieVal.substring(tokenName.length, cookieVal.indexOf(';'));
      }
    }

    cy.request({
      method: 'POST',
      url: '/accounts/login/',
      form: true,
      body: {
        username: username,
        password: password,
        csrfmiddlewaretoken: tokenVal
      }
    });
  });
});

// slow login using interface
Cypress.Commands.add('loginByInterface', (username = DEFAULT_USERNAME, password = DEFAULT_PASSWORD) => {
  cy.visit('/');
  cy.get('#id_username').type('kobo').should('have.value', username);
  cy.get('#id_password').type('kobo').should('have.value', password);
  cy.get('form.registration').submit();
});

// flush database
Cypress.Commands.add('flushDatabase', () => {
  console.warn('Flushing database not implemented yet');
  // cy.exec('docker exec kobo-docker_kpi_1 python ./manage.py flush --noinput');
});

Cypress.Commands.add('createAsset', (assetName) => {
  cy.getCookie('csrftoken').then((cookie) => {
    cy.request({
      method: 'POST',
      url: '/assets/',
      form: true,
      body: {
        name: assetName,
        settings: {
          description: '',
          sector: '',
          country: '',
          'share-metadata': true
        },
        asset_type: 'survey',
        csrfmiddlewaretoken: cookie.value
      }
    });
  });
});
