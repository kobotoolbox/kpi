/// <reference types="cypress" />
// ***********************************************************
// This example plugins/index.js can be used to load plugins
//
// You can change the location of this file or turn off loading
// the plugins file with the 'pluginsFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/plugins-guide
// ***********************************************************

// This function is called when a project is opened or re-opened (e.g. due to
// the project's config changing)

/**
 * @type {Cypress.PluginConfig}
 */
// eslint-disable-next-line no-unused-vars
module.exports = (on, config) => {
  // `on` is used to hook into various events Cypress emits
  // `config` is the resolved Cypress config

  // Use KOBOFORM_URL as baseUrl, if config.baseUrl has not been set yet.
  // Also give helpful errors to the console, and quit if no baseUrl is configured.
  /* eslint-disable no-console */
  const colorInfo = '\x1b[36m' // cyan
  const colorWarn = '\x1b[33m' // yellow
  const colorReset = '\x1b[0m'
  if (config.baseUrl) {
    // Tell user that baseUrl has been detected somehow (normal Cypress config)
    console.log(colorInfo)
    console.log('\n  Detected Cypress Base URL configuration')
    console.log('    (This takes precedence over KOBOFORM_URL)')
    console.log(`  Cypress Base URL: ${config.baseUrl}`)
    console.log(colorReset)
  } else if (process.env.KOBOFORM_URL) {
    config.baseUrl = process.env.KOBOFORM_URL
    // Tell user that baseUrl has been set by $KOBOFORM_URL
    console.log(colorInfo)
    console.log(`\n  Detected KOBOFORM_URL=${process.env.KOBOFORM_URL}`)
    console.log('    (You can override this with CYPRESS_BASE_URL)')
    console.log(`  Setting Cypress Base URL: ${config.baseUrl}`)
    console.log(colorReset)
  } else {
    console.log(colorWarn)
    console.log('\n No Cypress Base URL detected.')
    console.log(' Point KOBOFORM_URL or CYPRESS_BASE_URL to your kpi cypress_testserver.')
    console.log(' Example: KOBOFORM_URL=http://kf.kobo.local:8000')
    console.log(colorReset)
    throw new Error()
  }
  /* eslint-enable */

  return config
}
