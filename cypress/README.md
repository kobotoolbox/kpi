# Running tests

To run tests, you need to do 2 things:

1. [Start the **test server.**](#how-to-start-the-test-server) This is like a kpi server, but in a special cypress_testserver mode. (You will also need to restart it between Cypress test runs.)
2. [Use the **Cypress test runner.**](#how-to-run-cypress-tests) You can run this in command-line mode, or open an interactive browser window.

## How to start the test server

If you normally run kpi with `./manage.py runserver 0.0.0.0:8000`, you can use:

```
kpi$ DJANGO_SETTINGS_MODULE=kobo.settings.cypress  \
     ./manage.py cypress_testserver                \
       --addrport 0.0.0.0:8000                     \
       --noinput
```

If you're using [kobo-install](https//github.com/kobotoolbox/kobo-install):

```console
# Enter a bash session in the kpi container
kobo-install$  ./run.py -cf exec kpi bash

# Stop the server that is already running
root@kpi:/srv/src/kpi#   sv stop uwsgi
  ok: down: uwsgi: 0s, normally up

# Start the test server
root@kpi:/srv/src/kpi#   DJANGO_SETTINGS_MODULE=kobo.settings.cypress ./manage.py cypress_testserver --addrport 0.0.0.0:8000 --noinput
```

Note: If you get a ModuleNotFoundError, you may need to install
the dev dependencies. In your container:

```console
# Install dev dependencies (so you can run tests)
pip install -r dependencies/pip/dev_requirements.txt
```

<details><summary>About cypress_testserver</summary>

#### About cypress_testserver

The **cypress_testserver** provides fixtures for the Cypress tests.

```
DJANGO_SETTINGS_MODULE=kobo.settings.cypress (1) Use test server settings
              ./manage.py cypress_testserver (2) Run the test server
                     --addrport 0.0.0.0:8000 (3) Bind :8000 (check this)
                     --noinput               (4) Skip 'delete database' prompt
```

1. `DJANGO_SETTINGS_MODULE=kobo.settings.cypress` switches the server away from using your default kpi database. Source: [kpi/kobo/settings/cypress.py](../kobo/settings/cypress.py)
2. `./manage.py cypress_testserver`  is a custom management command. Starts a test server with fixtures created in Python specifically for Cypress tests.
    - [kpi/management/commands/cypress_testserver.py](../kpi/management/commands/cypress_testserver.py) - Add or change fixtures here.
    - [django-admin/#testserver](https://docs.djangoproject.com/en/4.0/ref/django-admin/#testserver) - Django's built-in `testserver`, which this is based on.
3. `--addrport 0.0.0.0:8000` - Change this if necessary. Use port 80 if you're running on http://kf.kobo.local, port 8000 if you're using kobo-install.
4. `--noinput` - Skips console prompts about clearing the existing test database.
</details>

Between subsequent Cypress test runs, you'll need to restart the test server to reset the fixture states. Interrupt it with `^C`, then re-run the above command to start the server again.

## How to run Cypress tests

<details>
<summary>Prerequisite: Install Cypress</summary>

### Installing Cypress

1. Navigate to the `cypress` folder.
2. Install cypress with `npm install`.

Cypress will likely ask you to install [some OS dependencies](https://on.cypress.io/required-dependencies) (about .5 GB) when you try to run a test.
</details>

Make sure `$KOBOFORM_URL` or `$CYPRESS_BASE_URL` points to your test server.

### Command line only tests

    kpi/cypress$ npx cypress run

### Cypress UI

    kpi/cypress$ npx cypress open

### Useful configuration options

> 🚧  *We are on an older version of cypress (8.7.0), so our configuration guide is located at [Legacy Configuration](https://docs.cypress.io/guides/references/legacy-configuration).*

Both commands (cypress run, cypress open) accept a comma-separated list of config values with the `--config` flag.

#### How to disable video/screenshot recording

If you're on a computer with limited resources, you may wish to use these:

```
  video=false                     Disable video recording of Cypress tests
  screenshotOnRunFailure=false    Disable screenshots of Cypress tests
```

For example, to run the command-line only tests with the above options, use `npx cypress run --config video=false,screenshotOnRunFailure=false`.

Alternatively, you could set the environment variables `CYPRESS_VIDEO` and `CYPRESS_SCREENSHOT_ON_RUN_FAILURE`.

#### How to override the baseUrl

We have configured Cypress to read its baseUrl from `KOBOFORM_URL` because it's likely you'll already have that set from kpi or kobo-install.

You can override this with `CYPRESS_BASE_URL`, or the config option equivalent, `baseUrl`.

# Writing tests

## Structure/Folders

- fixtures: basic parameters can be changed from the cypress/fixtures folder.
- integration: tests will go here.
- support: custom commands and code that is run before all tests. This is where cypress is told to keep the session open for all tests by remembering cookies.
- cypress.json: order in which tests are carried out

## Cypress Philosophy

- All tests should be independent.
- Elements should be selected with an attribute that is not expected to change.
- Conditional testing is strongly discouraged.
- Avoid using cy.wait or timeout as this will slow things down considerably.
