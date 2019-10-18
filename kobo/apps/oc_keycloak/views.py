# coding: utf-8

import logging
import requests
from django.conf import settings
from django.contrib.auth.forms import AuthenticationForm
from django.contrib.auth.views import login as auth_login_view
from django.shortcuts import redirect
from urlparse import urlparse
from tldextract import extract

from djangooidc.oidc import OIDCClients
from djangooidc.views import DynamicProvider
from bossoidc.settings import configure_oidc

from keycloak.realm import KeycloakRealm

logger = logging.getLogger(__name__)

CLIENTS = OIDCClients(settings)

def openid(request, op_name=None):
    full_uri_with_path = request.build_absolute_uri()
    parsed_full_uri_with_path = urlparse(full_uri_with_path)
    extracted_full_uri_with_path = extract(full_uri_with_path)

    current_root_uri = '{}://{}'.format(parsed_full_uri_with_path.scheme, parsed_full_uri_with_path.netloc)
    print current_root_uri

    current_domain = 'openclinica-dev.io'
    if 'openclinica' in full_uri_with_path:
        current_domain = '{}.{}'.format(extracted_full_uri_with_path.domain, extracted_full_uri_with_path.suffix)
    print current_domain
    subdomain = extracted_full_uri_with_path.subdomain.split('.')[0]

    allowed_connections_url = '{}://{}.build.{}/customer-service/api/allowed-connections'.format(request.scheme, subdomain, current_domain)
    allowed_connections_response = requests.get(
            allowed_connections_url,
            params={'subdomain': subdomain}
        )
    realm_name = allowed_connections_response.json()[0]
    print realm_name

    master_realm = KeycloakRealm(server_url='https://auth.{}/'.format(current_domain), realm_name=settings.KEYCLOAK_MASTER_REALM)
    master_realm_client = master_realm.open_id_connect(
            client_id=settings.KEYCLOAK_ADMIN_CLIENT_ID,
            client_secret=settings.KEYCLOAK_ADMIN_CLIENT_SECRET
        )
    access_token = master_realm_client.client_credentials()['access_token']
    
    admin_client = master_realm.admin
    admin_client.set_token(access_token)

    clients = admin_client.realms.by_name(realm_name).clients.all()
    clientId = settings.KEYCLOAK_CLIENT_ID
    client_id = None
    for client in clients:
        if client['clientId'] == clientId:
            client_id = client['id']
            break
    
    client_secret = None
    if client_id is not None:
        client_secret = admin_client.realms.by_name(realm_name).clients.by_id(client_id).client_secret()['value']

    if client_secret is not None:
        KEYCLOAK_AUTH_URI = "https://auth.{}/auth/realms/{}".format(current_domain, realm_name)
        KEYCLOAK_CLIENT_ID = clientId
        KEYCLOAK_CLIENT_SECRET = client_secret
        PUBLIC_URI_FOR_KEYCLOAK = current_root_uri
        configure_oidc(KEYCLOAK_AUTH_URI, KEYCLOAK_CLIENT_ID, PUBLIC_URI_FOR_KEYCLOAK, client_secret=KEYCLOAK_CLIENT_SECRET)

        CLIENTS = OIDCClients(settings)

    client = None
    request.session["next"] = request.GET["next"] if "next" in request.GET.keys() else "/"
    try:
        dyn = settings.OIDC_ALLOW_DYNAMIC_OP or False
    except:
        dyn = True

    try:
        template_name = settings.OIDC_LOGIN_TEMPLATE
    except AttributeError:
        template_name = 'djangooidc/login.html'

    # Internal login?
    if request.method == 'POST' and "internal_login" in request.POST:
        ilform = AuthenticationForm(request.POST)
        return auth_login_view(request)
    else:
        ilform = AuthenticationForm()

    # Try to find an OP client either from the form or from the op_name URL argument
    if request.method == 'GET' and op_name is not None:
        client = CLIENTS[op_name]
        request.session["op"] = op_name

    if request.method == 'POST' and dyn:
        form = DynamicProvider(request.POST)
        if form.is_valid():
            try:
                client = CLIENTS.dynamic_client(form.cleaned_data["hint"])
                request.session["op"] = client.provider_info["issuer"]
            except Exception as e:
                logger.exception("could not create OOID client")
                return render(request, ERROR_TEMPLATE, context={"error": e})
    else:
        form = DynamicProvider()

    # If we were able to determine the OP client, just redirect to it with an authentication request
    if client:
        try:
            return client.create_authn_request(request.session)
        except Exception as e:
            return render(request, ERROR_TEMPLATE, context={"error": e})

    # Otherwise just render the list+form.
    return render(request, template_name,
                  context={"op_list": [i for i in settings.OIDC_PROVIDERS.keys() if i], 'dynamic': dyn,
                           'form': form, 'ilform': ilform, "next": request.session["next"]}, )
