import os

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.management import call_command

from kobo.apps.kobo_auth.models import User
from kobo.apps.openrosa.apps.logger.models import Attachment, Instance
from kobo.apps.openrosa.apps.logger.models.xform import XForm
from kobo.apps.openrosa.apps.main.tests.test_base import TestBase
from kobo.apps.openrosa.libs.utils.image_tools import image_url
from kpi.deployment_backends.kc_access.storage import (
    default_kobocat_storage as default_storage,
)


class TestAttachment(TestBase):

    def setUp(self):
        super().setUp()
        self._publish_transportation_form_and_submit_instance()
        self.media_file = '1335783522563.jpg'
        media_file = os.path.join(
            self.this_directory,
            'fixtures',
            'transportation',
            'instances',
            self.surveys[0],
            self.media_file,
        )
        self.instance = Instance.objects.all()[0]
        with open(media_file, 'rb') as f:
            self.attachment = Attachment.objects.create(
                instance=self.instance,
                media_file=ContentFile(f.read(), name=self.media_file),
            )

    def test_mimetype(self):
        self.assertEqual(self.attachment.mimetype, 'image/jpeg')

    def test_thumbnails(self):
        for attachment in Attachment.objects.filter(instance=self.instance):
            url = image_url(attachment, 'small')
            filename = attachment.media_file.name.replace('.jpg', '')
            thumbnail = '%s-small.jpg' % filename
            self.assertNotEqual(url.find(thumbnail), -1)
            for size in ['small', 'medium', 'large']:
                thumbnail = f'{filename}-{size}.jpg'
                self.assertTrue(default_storage.exists(thumbnail))

            # Ensure clean-up is ok
            attachment.delete()
            for size in ['small', 'medium', 'large']:
                thumbnail = f'{filename}-{size}.jpg'
                self.assertFalse(default_storage.exists(thumbnail))

    def test_create_thumbnails_command(self):
        call_command('create_image_thumbnails')
        created_times = {}
        for attachment in Attachment.objects.filter(instance=self.instance):
            filename = attachment.media_file.name.replace('.jpg', '')
            for size in settings.THUMB_CONF.keys():
                thumbnail = '%s-%s.jpg' % (filename, size)
                self.assertTrue(default_storage.exists(thumbnail))
                created_times[size] = default_storage.get_modified_time(
                    thumbnail
                )
        # replace or regenerate thumbnails if they exist
        call_command('create_image_thumbnails', force=True)
        for attachment in Attachment.objects.filter(instance=self.instance):
            filename = attachment.media_file.name.replace('.jpg', '')
            for size in settings.THUMB_CONF.keys():
                thumbnail = f'{filename}-{size}.jpg'
                self.assertTrue(default_storage.exists(thumbnail))
                self.assertTrue(
                    default_storage.get_modified_time(thumbnail)
                    > created_times[size]
                )
                default_storage.delete(thumbnail)

    def test_attachment_save_populates_user_and_xform(self):
        user = User.objects.create_user(username='testuser', password='testpassword')
        f = open(
            os.path.join(
                os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                'Water_Translated_2011_03_10.xml',
            )
        )
        xml = f.read()
        f.close()
        xform = XForm.objects.create(xml=xml, user=user)
        instance = Instance.objects.all()[0]
        instance.xform = xform
        instance.save()

        media_file = os.path.join(
            self.this_directory,
            'fixtures',
            'transportation',
            'instances',
            self.surveys[0],
            self.media_file,
        )
        with open(media_file, 'rb') as f:
            attachment = Attachment.objects.create(
                instance=instance,
                media_file=ContentFile(f.read(), name=self.media_file),
            )

        attachment.refresh_from_db()
        self.assertEqual(attachment.user_id, user.id)
        self.assertEqual(attachment.xform_id, xform.id)
