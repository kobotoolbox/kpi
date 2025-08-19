from django.test import override_settings, TestCase

from kobo.apps.openrosa.apps.main.context_processors import site_name


class CustomContextProcessorsTest(TestCase):
    @override_settings(KOBOCAT_PUBLIC_HOSTNAME='kc.kobotoolbox.org')
    def test_site_name(self):
        context = site_name(None)
        self.assertEqual(context, {'SITE_NAME': 'kc.kobotoolbox.org'})
