APP_PROVIDER_ID = 'test-app'

SOCIALACCOUNT_PROVIDERS = {
    'openid_connect': {
        'SERVERS': [
            {
                'id': APP_PROVIDER_ID,
                'name': 'Test App',
                'server_url': 'http://testserver/oauth',
                'APP': {
                    'client_id': 'test.service.id',
                    'secret': 'test.service.secret',
                },
            }
        ]
    }
}
