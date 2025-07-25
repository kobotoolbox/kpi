// This code is adapted from the drf-spectacular project's default Swagger UI JavaScript.
// Original source: https://github.com/tfranzel/drf-spectacular/blob/master/drf_spectacular/templates/drf_spectacular/swagger_ui.js


document.addEventListener('DOMContentLoaded', function() {
    const swaggerUiDiv = document.getElementById('swagger-ui');
    const swaggerSettingsJson = swaggerUiDiv.dataset.swaggerSettings;
    const schemaAuthNamesJson = swaggerUiDiv.dataset.schemaAuthNames;
    const csrfHeaderName = swaggerUiDiv.dataset.csrfHeaderName;
    const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
    const schemaUrl = swaggerUiDiv.dataset.schemaUrl;
    const oauth2ConfigJson = swaggerUiDiv.dataset.oauth2Config;

    let swaggerSettings = {};
    if (swaggerSettingsJson) {
        try {
            swaggerSettings = JSON.parse(swaggerSettingsJson);
        } catch (e) {
            console.error("Error parsing swaggerSettings:", e);
        }
    }

    let schemaAuthNames = [];
    if (schemaAuthNamesJson) {
        try {
            schemaAuthNames = JSON.parse(schemaAuthNamesJson);
        } catch (e) {
            console.error("Error parsing schemaAuthNames:", e);
        }
    }

    let oauth2Config = null;
    if (oauth2ConfigJson && oauth2ConfigJson !== '{}') {
        try {
            oauth2Config = JSON.parse(oauth2ConfigJson);
        } catch (e) {
            console.error("Error parsing oauth2Config:", e);
        }
    }

    let schemaAuthFailed = false;
    const plugins = [];

    const reloadSchemaOnAuthChange = () => {
        return {
            statePlugins: {
                auth: {
                    wrapActions: {
                        authorizeOauth2:(ori) => (...args) => {
                            schemaAuthFailed = false;
                            setTimeout(() => ui.specActions.download());
                            return ori(...args);
                        },
                        authorize: (ori) => (...args) => {
                            schemaAuthFailed = false;
                            setTimeout(() => ui.specActions.download());
                            return ori(...args);
                        },
                        logout: (ori) => (...args) => {
                            schemaAuthFailed = false;
                            setTimeout(() => ui.specActions.download());
                            return ori(...args);
                        },
                    },
                },
            },
        };
    };

    if (schemaAuthNames.length > 0) {
        plugins.push(reloadSchemaOnAuthChange);
    }

    const uiInitialized = () => {
      try {
        ui;
        return true;
      } catch {
        return false;
      }
    };

    const isSchemaUrl = (url) => {
        if (!uiInitialized()) {
            return false;
        }
        return url ===  new URL(ui.getConfigs().url, document.baseURI).href;
    };

    const responseInterceptor = (response, ...args) => {
        if (!response.ok && isSchemaUrl(response.url)) {
            console.warn("schema request received '" + response.status + "'. disabling credentials for schema till logout.");
            if (!schemaAuthFailed) {
                schemaAuthFailed = true;
                setTimeout(() => ui.specActions.download());
            }
        }
        return response;
    };

    const injectAuthCredentials = (request) => {
      let authorized;
      if (uiInitialized()) {
        const state = ui.getState().get("auth").get("authorized");
        if (state !== undefined && Object.keys(state.toJS()).length !== 0) {
          authorized = state.toJS();
        }
      } else if (![undefined, "{}"].includes(localStorage.authorized)) {
        authorized = JSON.parse(localStorage.authorized);
      }
      if (authorized === undefined) {
        return;
      }
      for (const authName of schemaAuthNames) {
        const authDef = authorized[authName];
        if (authDef === undefined || authDef.schema === undefined) {
          continue;
        }
        if (authDef.schema.type === "http" && authDef.schema.scheme === "bearer") {
          request.headers["Authorization"] = "Bearer " + authDef.value;
          return;
        } else if (authDef.schema.type === "http" && authDef.schema.scheme === "basic") {
          request.headers["Authorization"] = "Basic " + btoa(authDef.value.username + ":" + authDef.value.password);
          return;
        } else if (authDef.schema.type === "apiKey" && authDef.schema.in === "header") {
          request.headers[authDef.schema.name] = authDef.value;
          return;
        } else if (authDef.schema.type === "oauth2" && authDef.token.token_type === "Bearer") {
          request.headers["Authorization"] = `Bearer ${authDef.token.access_token}`;
          return;
        }
      }
    };

    const requestInterceptor = (request, ...args) => {
        if (request.loadSpec && schemaAuthNames.length > 0 && !schemaAuthFailed) {
            try {
                injectAuthCredentials(request);
            } catch (e) {
                console.error('schema auth injection failed with error: ', e);
            }
        }
        // selectively omit adding headers to mitigate CORS issues.
        if (!['GET', undefined].includes(request.method) && request.credentials === 'same-origin') {
            request.headers[csrfHeaderName] = csrfToken;
        }
        return request;
    };

   const ui = SwaggerUIBundle({
        url: schemaUrl,
        dom_id: '#swagger-ui',
        presets: [SwaggerUIBundle.presets.apis],
        plugins,
        layout: 'BaseLayout',
        requestInterceptor,
        responseInterceptor,
        ...swaggerSettings,
        filter: true,
    });

    if (oauth2Config && Object.keys(oauth2Config).length > 0) {
        ui.initOAuth(oauth2Config);
    }
});
