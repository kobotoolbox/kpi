import os
from io import BytesIO
from unittest.mock import patch

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.management import call_command
from freezegun import freeze_time
from PIL import ExifTags, Image

from kobo.apps.kobo_auth.models import User
from kobo.apps.openrosa.apps.logger.models import Attachment, Instance
from kobo.apps.openrosa.apps.logger.models.xform import XForm
from kobo.apps.openrosa.apps.main.tests.test_base import TestBase
from kobo.apps.openrosa.libs.tests.utils import image_url
from kobo.apps.openrosa.libs.utils.image_tools import resize
from kobo.apps.openrosa.libs.utils.viewer_tools import get_optimized_image_path
from kpi.constants import SAFE_INLINE_MIMETYPES
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

    def test_heic_named_file_generates_jpg_thumbnails(self):
        media_file_name = 'test_image.heic'
        media_file = os.path.join(
            os.path.dirname(os.path.dirname(__file__)),
            'fixtures',
            'images',
            media_file_name
        )
        with open(media_file, 'rb') as f:
            attachment = Attachment.objects.create(
                instance=self.instance,
                media_file=ContentFile(f.read(), name=media_file_name),
            )

        image_url(attachment, 'small')
        for size in ['small', 'medium', 'large']:
            filename = attachment.media_file.name.replace('.heic', '')
            thumbnail = f'{filename}-{size}.jpg'
            self.assertTrue(default_storage.exists(thumbnail))

        # Ensure clean up of thumbnails
        attachment.delete()
        for size in ['small', 'medium', 'large']:
            filename = attachment.media_file.name.replace('.heic', '')
            thumbnail = f'{filename}-{size}.jpg'
            self.assertFalse(default_storage.exists(thumbnail))

    def test_thumbnails_follow_exif_orientation(self):
        # Landscape pixels with an EXIF orientation of 6 (rotate 90° clockwise),
        # as some cameras save portrait photos. The red left half must end up
        # at the top once rotated
        image = Image.new('RGB', (1200, 600), 'blue')
        image.paste('red', (0, 0, 600, 600))
        exif = image.getexif()
        exif[ExifTags.Base.Orientation] = 6
        buffer = BytesIO()
        image.save(buffer, format='JPEG', exif=exif)
        attachment = Attachment.objects.create(
            instance=self.instance,
            media_file=ContentFile(buffer.getvalue(), name='rotated.jpg'),
        )

        image_url(attachment, 'small')
        for size in ['small', 'medium', 'large']:
            thumbnail = get_optimized_image_path(attachment.media_file.name, size)
            with default_storage.open(thumbnail) as f, Image.open(f) as thumb:
                width, height = thumb.size
                top_r, _, top_b = thumb.getpixel((width // 2, height // 4))
            assert height > width
            assert top_r > 200 and top_b < 50

        attachment.delete()

    def test_protected_path_serves_original_when_image_cannot_be_resized(self):
        attachment = Attachment.objects.create(
            instance=self.instance,
            media_file=ContentFile(
                b'<svg xmlns="http://www.w3.org/2000/svg"/>', name='drawing.svg'
            ),
        )
        assert attachment.mimetype == 'image/svg+xml'

        # Pillow cannot open an SVG: the original is served, no thumbnail is made.
        # Freeze the clock so that both presigned S3 URLs share one signature date.
        with freeze_time():
            assert (
                attachment.protected_path(suffix='small') == attachment.protected_path()
            )
        thumbnail = get_optimized_image_path(attachment.media_file.name, 'small')
        assert not default_storage.exists(thumbnail)

    def test_create_thumbnails_command(self):
        call_command('create_image_thumbnails')
        for attachment in Attachment.objects.filter(instance=self.instance):
            filename = attachment.media_file.name.replace('.jpg', '')
            for size in settings.THUMB_CONF.keys():
                thumbnail = '%s-%s.jpg' % (filename, size)
                self.assertTrue(default_storage.exists(thumbnail))

        # replace or regenerate thumbnails if they exist. Storage modified times
        # are only precise to the second, so check that `resize()` ran again
        # instead of comparing them.
        with patch(
            'kobo.apps.openrosa.apps.logger.management.commands'
            '.create_image_thumbnails.resize',
            wraps=resize,
        ) as mock_resize:
            call_command('create_image_thumbnails', force=True)

        for attachment in Attachment.objects.filter(instance=self.instance):
            mock_resize.assert_any_call(attachment.media_file.name)
            filename = attachment.media_file.name.replace('.jpg', '')
            for size in settings.THUMB_CONF.keys():
                thumbnail = f'{filename}-{size}.jpg'
                self.assertTrue(default_storage.exists(thumbnail))
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

    def test_content_disposition(self):
        for mimetype in SAFE_INLINE_MIMETYPES:
            attachment = Attachment(media_file='foo.jpg', mimetype=mimetype)
            assert attachment.content_disposition == 'inline'

        # Ensure SVG is mimetype
        attachment = Attachment(media_file='foo.svg', mimetype='image/svg+xml')
        assert attachment.content_disposition == 'attachment'

        # Random mimetype
        attachment = Attachment(media_file='foo.jpg', mimetype='foo/bar')
        assert attachment.content_disposition == 'attachment'

    def test_set_media_base_name(self):
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
                media_file_basename='foo.jpg',
            )

        assert attachment.media_file_basename == 'foo.jpg'

        attachment.delete()
        with open(media_file, 'rb') as f:
            attachment = Attachment.objects.create(
                instance=instance,
                media_file=ContentFile(f.read(), name=self.media_file),
            )
        assert attachment.media_file_basename == '1335783522563.jpg'
