from django.conf import settings
from django.utils.encoding import smart_str
from pyxform.xform2json import create_survey_element_from_xml

from kobo.apps.openrosa.apps.viewer.models.data_dictionary import DataDictionary
from kobo.apps.openrosa.libs.utils.image_tools import resize
from kobo.apps.openrosa.libs.utils.model_tools import set_uuid
from kobo.apps.openrosa.libs.utils.viewer_tools import get_optimized_image_path
from kpi.deployment_backends.kc_access.storage import (
    default_kobocat_storage as default_storage,
)


def image_url(attachment, suffix):
    """
    Return url of an image given size(@param suffix)
    e.g large, medium, small, or generate required thumbnail
    """
    url = attachment.media_file.url
    if suffix == 'original':
        return url
    else:
        if suffix in settings.THUMB_CONF:
            filename = attachment.media_file.name
            if default_storage.exists(filename):
                if (
                    default_storage.exists(get_optimized_image_path(filename, suffix))
                    and default_storage.size(get_optimized_image_path(filename, suffix))
                    > 0
                ):
                    url = default_storage.url(
                        get_optimized_image_path(filename, suffix)
                    )
                else:
                    resize(filename)
                    return image_url(attachment, suffix)
            else:
                return None
    return url


def publish_xml_form(xml_file, user) -> DataDictionary:
    """
    Create an XForm from an XForm XML file, without any XLSForm
    """

    xml = smart_str(xml_file.read())
    survey = create_survey_element_from_xml(xml)
    xform = DataDictionary(user=user, xml=xml, json=survey.to_json())
    xform.mark_start_time_boolean()
    set_uuid(xform)
    xform.set_uuid_in_xml()
    xform.save()
    return xform
