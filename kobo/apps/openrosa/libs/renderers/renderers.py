# coding: utf-8
import io

from django.utils.xmlutils import SimplerXMLGenerator
from django.utils.encoding import smart_str
from rest_framework.negotiation import DefaultContentNegotiation
from rest_framework.renderers import BaseRenderer
from rest_framework.renderers import TemplateHTMLRenderer
from rest_framework.renderers import StaticHTMLRenderer
from rest_framework_xml.renderers import XMLRenderer


class XLSRenderer(BaseRenderer):
    media_type = 'application/vnd.openxmlformats'
    format = 'xls'
    charset = None

    def render(self, data, accepted_media_type=None, renderer_context=None):
        return data


class XLSXRenderer(XLSRenderer):
    format = 'xlsx'


class CSVRenderer(BaseRenderer):
    media_type = 'text/csv'
    format = 'csv'
    charset = 'utf-8'

# TODO add KML, ZIP(attachments) support


class RawXMLRenderer(BaseRenderer):
    media_type = 'application/xml'
    format = 'xml'
    charset = 'utf-8'

    def render(self, data, accepted_media_type=None, renderer_context=None):
        return data


class MediaFileContentNegotiation(DefaultContentNegotiation):

    def filter_renderers(self, renderers, format):
        """
        If there is a '.json' style format suffix, filter the renderers
        so that we only negotiation against those that accept that format.
        If there is no renderer available, we use MediaFileRenderer.
        """
        renderers = [renderer for renderer in renderers
                     if renderer.format == format]
        if not renderers:
            renderers = [MediaFileRenderer()]

        return renderers


class MediaFileRenderer(BaseRenderer):
    media_type = '*/*'
    format = None
    charset = None
    render_style = 'binary'

    def render(self, data, accepted_media_type=None, renderer_context=None):
        return data


class XFormListRenderer(BaseRenderer):
    """
    Renderer which serializes to XML.
    """

    media_type = 'text/xml'
    format = 'xml'
    charset = 'utf-8'
    root_node = 'xforms'
    element_node = 'xform'
    xmlns = "http://openrosa.org/xforms/xformsList"

    def render(self, data, accepted_media_type=None, renderer_context=None):
        """
        Renders *obj* into serialized XML.
        """
        if data is None:
            return ''
        elif isinstance(data, str):
            return data

        stream = io.StringIO()

        xml = SimplerXMLGenerator(stream, self.charset)
        xml.startDocument()
        xml.startElement(self.root_node, {'xmlns': self.xmlns})

        self._to_xml(xml, data)

        xml.endElement(self.root_node)
        xml.endDocument()
        return stream.getvalue()

    def _to_xml(self, xml, data):
        if isinstance(data, (list, tuple)):
            for item in data:
                xml.startElement(self.element_node, {})
                self._to_xml(xml, item)
                xml.endElement(self.element_node)

        elif isinstance(data, dict):
            for key, value in data.items():
                xml.startElement(key, {})
                self._to_xml(xml, value)
                xml.endElement(key)

        elif data is None:
            # Don't output any value
            pass

        else:
            xml.characters(smart_str(data))


class XFormManifestRenderer(XFormListRenderer):
    root_node = "manifest"
    element_node = "mediaFile"
    xmlns = "http://openrosa.org/xforms/xformsManifest"


class TemplateXMLRenderer(TemplateHTMLRenderer):
    format = 'xml'
    media_type = 'text/xml'

    def render(self, data, accepted_media_type=None, renderer_context=None):
        renderer_context = renderer_context or {}
        response = renderer_context['response']

        if response and response.exception:
            return XMLRenderer().render(
                data, accepted_media_type, renderer_context)

        return super().render(
            data, accepted_media_type, renderer_context)


class StaticXMLRenderer(StaticHTMLRenderer):
    format = 'xml'
    media_type = 'text/xml'


class InstanceContentNegotiation(DefaultContentNegotiation):

    def filter_renderers(self, renderers, format):
        """
        Removes `rest_framework_xml.renderers.XMLRenderer` from the renderers list to
        prioritize `RawXMLRenderer`.
        Useful to display xml of Instance without any parsing.

        :param renderers: list
        :param format: str
        :return: list
        """
        renderers = [renderer for renderer in renderers
                     if renderer.format == format and
                     isinstance(renderer, XMLRenderer) is False]
        return renderers
