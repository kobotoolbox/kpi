from allauth.socialaccount.providers.base import Provider


class MockProvider(Provider):
    id = 'mock_provider'
    uses_apps = False
    name = 'Mock Provider'
