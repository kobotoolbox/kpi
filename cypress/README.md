# How to start the test server

# How to run a test

`$./node_modules/.bin/cypress open`


# Structure/Folders:

    fixures: basic parameters can be changed from the cypress/fixtures folder.  
    integration: tests will go here.  
    support: custom commands and code that is run before all tests. This is where cypress is told to keep the session open for all tests by remembering cookies.  
    cypress.json: order in which tests are carried out

# Cypress Philosophy:

    All tests should be independent.
    Elements should get got with an attribute that is not expected to change.
    Conditional testing is strongly discouraged.
