from django.contrib import admin
from django.test import RequestFactory, TestCase

from kobo.apps.kobo_auth.shortcuts import User
from ..models.transcription import TranscriptionService, TranscriptionServiceAdmin
from ..models.translation import TranslationService, TranslationServiceAdmin


class LanguageServiceAdminTestCase(TestCase):

    fixtures = ['test_data']

    def setUp(self):
        self.request = RequestFactory().get('/')
        self.request.user = User.objects.get(username='adminuser')
        self.admins = [
            (TranscriptionService, TranscriptionServiceAdmin),
            (TranslationService, TranslationServiceAdmin),
        ]

    def test_code_is_readonly_on_existing_service_only(self):
        """
        `code` can be set when adding a service but not changed afterwards
        """
        for model, admin_class in self.admins:
            model_admin = admin_class(model, admin.site)
            service = model.objects.get(code='goog')
            assert 'code' not in model_admin.get_readonly_fields(self.request)
            assert 'code' in model_admin.get_readonly_fields(self.request, obj=service)

    def test_ordering_by_priority_then_name(self):
        """
        Services with a lower priority are listed first
        """
        for model, admin_class in self.admins:
            model_admin = admin_class(model, admin.site)
            model.objects.filter(code='msft').update(priority=1)
            codes = list(
                model_admin.get_queryset(self.request).values_list('code', flat=True)
            )
            assert codes == ['msft', 'goog']
