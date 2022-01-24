# Cypress Test Runner
KoboToolbox Cypress Test Runner

`$npm init`
`npm install cypress`
`$./node_modules/.bin/cypress open`

->run integration spec


# Structure:

    fixures: json data used by the tests.  
    integration: the code for the tests themself.  
    support: custom commands and code that is run before all tests. This is where cypress is told to keep the session open for all tests by remembering cookies.  
    cypress.json: order in which tests are carried out

# Cypress Philosophy:

    All tests should be independent.
    Elements should get got with an attribute that is not expected to change.
    Conditional testing is strongly discouraged.
