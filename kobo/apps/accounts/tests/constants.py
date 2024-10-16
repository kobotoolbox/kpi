SOCIALACCOUNT_PROVIDERS = {
    'openid_connect': {
        'SERVERS': [
            {
                'id': 'test-app',
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
