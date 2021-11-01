# coding: utf-8
from urllib.parse import urlencode

from requests.models import HTTPError
from kpi.utils.log import logging
from social_core.backends.oauth import BaseOAuth2
from social_core.utils import handle_http_errors, parse_qs
from social_django.strategy import DjangoStrategy
from social_core.pipeline.social_auth import *

class VeritreeOAuth2(BaseOAuth2):
    name = 'veritree'
    AUTHORIZATION_URL = None
    ROOT_URL = 'https://beta.veritree.org'
    ACCESS_TOKEN_URL = '{root_url}/oauth/token/'.format(root_url=ROOT_URL)
    ACCESS_TOKEN_METHOD = 'POST'
    SCOPE_SEPARATOR = ','
    REDIRECT_STATE = False
    RESPONSE_TYPE = 'password'

    EXTRA_DATA = [('user_orgs', 'user_orgs')]
    client_id = '5'
    client_secret = 'vRVzWCB51hseGQeLiaDkDuPIYwWNL3kolg3lqwWt'

    

    def authenticate(self, *args, **kwargs):
        """
        Authenticate with username and password
        Username: Veritree.org username
        Password: Password corresponding to the veritree user
        """
        try:
            access_token_response = self.request_access_token(
                self.access_token_url(),
                data={
                    'password': kwargs['password'],
                    'username': kwargs['username'],
                    'grant_type': 'password',
                    'client_id': self.client_id,
                    'client_secret': self.client_secret
                },
                headers=self.auth_headers(),
                method=self.ACCESS_TOKEN_METHOD
            )
        except HTTPError:
            return None

        try:
            self.process_error(access_token_response)
        except:
            return None

        # Request rest of user data
        try:
            user_response = self.user_data(access_token_response['access_token'], *args, **kwargs)
        except:
            return None
        
        return self.authenticate_with_access_token_response(user_response, access_token_response, *args, **kwargs)
    
    def authenticate_with_access_token_response(self, user_response = {}, access_token_response = {}, *args, **kwargs):
        user_response.update(access_token_response)
        kwargs['response'] = user_response
        kwargs.setdefault('is_new', False)
        pipeline = self.strategy.get_pipeline(self)
        args, kwargs = self.strategy.clean_authenticate_args(*args, **kwargs)
        return self.pipeline(pipeline, *args, **kwargs)

    def user_data(self, access_token, *args, **kwargs):
        """Loads user data from service"""
        url = '{root_url}/api/me'.format(root_url=self.ROOT_URL)
        headers = {'Authorization': 'Bearer {}'.format(access_token)}
        return self.get_json(url, headers=headers)
    
    def get_user_details(self, response):
        data = response.get('data', response)
        
        return {
            'email': data.get('email'),
            'first_name': data.get('firstname'),
            'last_name': data.get('lastname'),
            'id': data.get('id'),
            'username': self.get_cleaned_username(data.get('email')),
            'user_orgs': data.get('user_orgs')
        }

    def get_cleaned_username(self, email):
        # Purpose is to strip out the @ and . characters and replace with a character
        # that is not typically allowed in emails to prevent collisions in the off chance
        # Presence of the . character is causing lookups to fail
        if email:
            return email.lower()
        
        return email

    def get_user_id(self, details, response):
        return details.get(self.ID_KEY)