from __future__ import annotations

import re
from typing import Optional, Union
from xml.dom import Node

from defusedxml import minidom
from defusedxml.lxml import fromstring
from django.db.models import F, Q
from django.db.models.query import QuerySet
from django_request_cache import cache_for_request
from lxml import etree
from shortuuid import ShortUUID

from kobo.apps.form_disclaimer.models import FormDisclaimer
from kpi.exceptions import DTDForbiddenException, EntitiesForbiddenException

# Goals for the future:
#
# 1. All XML handling is done in this file. No other files import anything from
#    xml, lxml, etc. directly; instead, they import helpers from this file.
#
# 2. All XML parsing is done by defusedxml. However:
#     The defusedxml modules are not drop-in replacements of their stdlib
#     counterparts. The modules only provide functions and classes related to
#     parsing and loading of XML. For all other features, use the classes,
#     functions, and constants from the stdlib modules.
#     (https://github.com/tiran/defusedxml)
#
# The imports below are those given as examples by the defusedxml
# "documentation" (the README), except for correcting a typo in the second
# import:
from defusedxml import ElementTree as DET
from xml.etree import ElementTree as ET


def add_xml_declaration(
    xml_content: Union[str, bytes], newlines: bool = False
) -> Union[str, bytes]:
    xml_declaration = '<?xml version="1.0" encoding="utf-8"?>'
    # Should support ̀ lmxl` and `dict2xml`
    start_of_declaration = '<?xml'
    use_bytes = False
    xml_content_as_str = xml_content.strip()

    if isinstance(xml_content, bytes):
        use_bytes = True
        xml_content_as_str = xml_content.decode()

    if (
        xml_content_as_str[:len(start_of_declaration)].lower()
        == start_of_declaration.lower()
    ):
        # There's already a declaration. Don't add anything.
        return xml_content

    newlines_char = '\n' if newlines else ''
    xml_ = f'{xml_declaration}{newlines_char}{xml_content_as_str}'
    if use_bytes:
        return xml_.encode()
    return xml_


def check_entities(
    elementtree: etree.ElementTree,
    dtd_forbidden: bool = False,
    entities_forbidden: bool = True
):
    """
    This function is to be used with the lxml library using examples
    found in the defusedxml library since support for lxml is depreciated
    Does not return content. This function will only raise exceptions if
    unaccepted content is contained in the XML.
    """

    docinfo = elementtree.docinfo
    if docinfo.doctype:
        if dtd_forbidden:
            raise DTDForbiddenException
        if entities_forbidden:
            raise EntitiesForbiddenException

    if entities_forbidden:
        for dtd_entity in docinfo.internalDTD, docinfo.externalDTD:
            if dtd_entity is None:
                continue
            for entity in dtd_entity.interentities():
                raise EntitiesForbiddenException


def check_lxml_fromstring(
    text: str,
    base_url: str = None,
    forbid_dtd: bool = False,
    forbid_entities: bool = True,
):
    """
    This function is used to replace the `lxml.etree.fromstring` method similarly to
    defusedxml's replacement for the method.
    Returns an ElementTree object
    """
    rootelement = fromstring(text, base_url=base_url)
    elementtree = rootelement.getroottree()
    check_entities(elementtree, forbid_dtd, forbid_entities)
    return rootelement


def edit_submission_xml(
    xml_parsed: 'xml.etree.ElementTree.Element',
    path: str,
    value: Union[str, list],
) -> None:
    """
    Edit submission XML with an XPath and new value, creating a new tree
    element if the path doesn't yet exist.
    """
    if isinstance(value, list):
        _edit_repeat_group(xml_parsed, path, value)
    else:
        element = get_or_create_element(xml_parsed, path)
        element.text = value


def _edit_repeat_group(
    xml_parsed: ET.Element,
    repeat_group_path: str,
    items: list,
) -> None:
    """
    Replace all existing repeat group elements with new ones from the items list.
    """
    path_parts = repeat_group_path.split('/')
    repeat_tag = path_parts[-1]
    parent_path = '/'.join(path_parts[:-1])

    if parent_path:
        parent_el = get_or_create_element(xml_parsed, parent_path)
    else:
        parent_el = xml_parsed

    existing_repeats = parent_el.findall(repeat_tag)
    for existing in existing_repeats:
        parent_el.remove(existing)

    for item in items:
        repeat_el = ET.Element(repeat_tag)
        parent_el.append(repeat_el)

        for full_path, field_value in item.items():
            relative_path = _extract_relative_path(full_path, repeat_group_path)

            if isinstance(field_value, list):
                _edit_repeat_group(repeat_el, relative_path, field_value)
            else:
                field_el = get_or_create_element(repeat_el, relative_path)
                field_el.text = str(field_value) if field_value is not None else ''


def _extract_relative_path(full_path: str, repeat_group_path: str) -> str:
    """
    Extract the relative path within a repeat group.
    """
    if full_path.startswith(repeat_group_path + '/'):
        return full_path[len(repeat_group_path) + 1:]
    return full_path.split('/')[-1]


def fromstring_preserve_root_xmlns(
    text: str,
    forbid_dtd: bool = False,
    forbid_entities: bool = True,
    forbid_external: bool = True,
) -> ET.Element:
    """
    Parse an XML string, but leave the default namespace in the `xmlns`
    attribute if the root element has one, and do not use Clark notation
    prefixes on tag names for the default namespace.

    Copied from `defusedxml.common._generate_etree_functions()`, except that
    the `target` is changed to a custom class. Necessary because
    `defusedxml.ElementTree.fromstring()`, unlike the standard library
    `xml.etree.ElementTree.fromstring()`, does not allow specifying a parser.
    """
    parser = DET.DefusedXMLParser(
        target=OmitDefaultNamespacePrefixTreeBuilder(),
        forbid_dtd=forbid_dtd,
        forbid_entities=forbid_entities,
        forbid_external=forbid_external,
    )
    parser.feed(text)
    return parser.close()


def get_or_create_element(
    xml_parsed: ET.Element,
    path: str,
) -> ET.Element:
    """
    Return the element at the given `path`, creating it (and all necessary
    ancestors) if it does not exist. Beware that this creation logic is VERY
    simplistic and interpets the `path` as a simple slash-separated list of
    tags.
    """

    el = xml_parsed.find(path)
    if el is not None:
        return el

    # Construct the tree of elements, one node at a time
    path_parts = path.split('/')
    traversed_parts = []
    parent_el = xml_parsed
    for part in path_parts:
        traversed_parts.append(part)
        el = xml_parsed.find('/'.join(traversed_parts))
        if el is None:
            el = ET.Element(part)
            parent_el.append(el)
        parent_el = el

    return el


def strip_nodes(
    source: Union[str, bytes],
    nodes_to_keep: list,
    use_xpath: bool = False,
    xml_declaration: bool = False,
    rename_root_node_to: Optional[str] = None,
    bulk_action_cache_key: str = None,
) -> str:
    """
    Returns a stripped version of `source`. It keeps only nodes provided in
    `nodes_to_keep`.
    If `rename_root_node_to` is provided, the root node will be renamed to the
    value of that parameter in the returned XML string.

    A random string can be passed to `bulk_action_cache_key` to get the
    XPaths only once if calling `strip_nodes()` several times in a loop.
    """
    # Force `source` to be bytes in case it contains an XML declaration
    # `etree` does not support strings with xml declarations.
    if isinstance(source, str):
        source = source.encode()

    # Build xml to be parsed
    xml_doc = etree.fromstring(source)
    tree = etree.ElementTree(xml_doc)
    root_element = tree.getroot()
    root_path = tree.getpath(root_element)

    # `@cache_for_request` uses the parameters of the function it decorates
    # to generate the key under which the returned value of the function is
    # stored for cache purpose.
    # `cache_key` is only there to serve that purpose and ensure
    # `@cache_for_request` uniqueness.
    @cache_for_request
    def get_xpath_matches(cache_key: str):
        if use_xpath:
            xpaths_ = []
            for xpath_ in nodes_to_keep:
                xpaths_.append(f"/{xpath_.strip('/')}/")
            return xpaths_

        xpath_matches = []
        # Retrieve XPaths of all nodes we need to keep
        for node_to_keep in nodes_to_keep:
            for node in tree.iter(node_to_keep):
                xpath_match = remove_root_path(tree.getpath(node))
                # To make a difference between XPaths with same beginning
                # string, we need to add a trailing slash for later comparison
                # in `process_node()`.
                # For example, `subgroup1` would match both `subgroup1/` and
                # `subgroup11/`, but `subgroup1/` correctly excludes
                # `subgroup11/`
                xpath_matches.append(f'{xpath_match}/')

        return xpath_matches

    def process_node(node_: etree._Element, xpath_matches_: list):
        """
        `process_node()` is a recursive function.

        First, it loops through all children of the root element.
        Then for each child, it loops through its children if any, etc...
        When all children are processed, it checks whether the node should be
        removed or not.

        The most nested children are processed first in order to know which
        parents must be kept.

        For example:
        With `nodes_to_keep = ['question_2', 'question_3']` and this XML:
        <root>
          <group>
              <question_1>Value1</question_1>
              <question_2>Value2</question_2>
          </group>
          <question_3>Value3</question_3>
        </root>

         Nodes are processed in this order:
         - `<question_1>`: Removed because not in `nodes_to_keep`

         - `<question_2>`: Kept. Parent node `<group>` is tagged `do_not_delete`

         - `<group>`: Kept even if it is not in `nodes_to_keep` because
                      it is tagged `do_not_delete` by its child `<question_2>`

         - `<question_3>`: Kept.

        Results:
        <root>
          <group>
              <question_2>Value2</question1>
          </group>
          <question3>Value3</question3>
        </root>
        """
        for child in node_.getchildren():
            process_node(child, xpath_matches_)

        # Get XPath of current node
        node_xpath = remove_root_path(tree.getpath(node_))

        # If `node_path` does not start with one of the occurrences previously
        # found, it must be removed.
        if (
            not f'{node_xpath}/'.startswith(tuple(xpath_matches_))
            and node_.get('do_not_delete') != 'true'
        ):
            if node_ != root_element:
                node_.getparent().remove(node_)
        elif node_xpath != '':
            # node matches, keep its parent too.
            node_.getparent().set('do_not_delete', 'true')

        # All children have been processed and `node_` seems to be a parent we
        # need to keep. Remove `do_not_delete` flag to avoid rendering it in
        # final xml
        if node_.attrib.get('do_not_delete'):
            del node_.attrib['do_not_delete']

    def remove_root_path(path_: str) -> str:
        return path_.replace(root_path, '')

    if len(nodes_to_keep):
        # Always sends an unique string to `get_xpath_matches()`
        # See comments above the function
        if bulk_action_cache_key is None:
            cache_key = ShortUUID().random(24)
        else:
            cache_key = bulk_action_cache_key

        xpath_matches = get_xpath_matches(cache_key=cache_key)
        process_node(root_element, xpath_matches)

    if rename_root_node_to:
        tree.getroot().tag = rename_root_node_to

    return etree.tostring(
        tree,
        pretty_print=True,
        encoding='utf-8',
        xml_declaration=xml_declaration,
    ).decode()


def xml_tostring(el: ET.Element) -> str:
    """
    Thin wrapper around `ElementTree.tostring()` as a step toward a future
    where all XML handling is done in this file
    """
    # "Use encoding="unicode" to generate a Unicode string (otherwise, a
    # bytestring is generated)."
    # https://docs.python.org/3.10/library/xml.etree.elementtree.html#xml.etree.ElementTree.tostring
    return DET.tostring(el, encoding='unicode')


class OmitDefaultNamespacePrefixTreeBuilder(ET.TreeBuilder):
    """
    If the root element has a default namespace (`xmlns` attribute), continue
    storing it in that attribute instead of moving it into a Clark notation
    prefix on the tag name of the root and all children.
    """
    def __init__(self, *args, **kwargs):
        self.default_namespace_uri = None
        self.parsing_root_element = True
        super().__init__(*args, **kwargs)

    def start_ns(self, prefix, uri):
        if (
            self.parsing_root_element
            and prefix == ''
            and self.default_namespace_uri is None
        ):
            # The default namespace!
            self.default_namespace_uri = uri
        if hasattr(super(), 'start_ns'):
            return super().start_ns(prefix, uri)

    def start(self, tag, attrs):
        # This method is called after `start_ns()`
        if self.parsing_root_element:
            self.parsing_root_element = False
            if self.default_namespace_uri:
                # Add the default namespace back to the `xmlns` attribute
                # of the root element
                attrs['xmlns'] = self.default_namespace_uri
        if self.default_namespace_uri:
            # Remove the Clark notation prefix if it matches the default
            # namespace
            tag = tag.removeprefix('{' + self.default_namespace_uri + '}')
        return super().start(tag, attrs)


class XMLFormWithDisclaimer:

    def __init__(self, obj: Union['kpi.AssetSnapshot', 'logger.XForm']):
        self._object = obj
        self._unique_id = obj.asset.uid

        # Avoid accessing the `xform_root_node_name` property immediately to prevent
        # extra database queries. It will be set only when it is actually needed.
        self._root_tag_name = None
        self._add_disclaimer()

    def get_object(self):
        return self._object

    def _add_disclaimer(self):

        asset = self._object.asset

        if not (disclaimers := self._get_disclaimers(asset)):
            return

        if not (value := self._get_translations(disclaimers)):
            return

        translated, disclaimers_dict, default_language_code = value

        self._root_node = minidom.parseString(self._object.xml)
        self._root_tag_name = self._object.xform_root_node_name

        if translated:
            self._add_translation_nodes(disclaimers_dict, default_language_code)

        self._add_instance_and_bind_nodes()
        self._add_disclaimer_input(
            translated, disclaimers_dict, default_language_code
        )

        self._object.xml = self._root_node.toxml(encoding='utf-8').decode()

    def _add_instance_and_bind_nodes(self):
        # Search for main <model> node
        model_node = [
            n
            for n in self._root_node.getElementsByTagName('h:head')[0].childNodes
            if n.nodeType == Node.ELEMENT_NODE and n.tagName == 'model'
        ][0]

        # Inject <bind nodeset /> inside <model odk:xforms-version="1.0.0">
        bind_node = self._root_node.createElement('bind')
        bind_node.setAttribute(
            'nodeset', f'/{self._root_tag_name}/_{self._unique_id}__disclaimer'
        )
        bind_node.setAttribute('readonly', 'true()')
        bind_node.setAttribute('required', 'false()')
        bind_node.setAttribute('type', 'string')
        bind_node.setAttribute('relevant', 'false()')
        model_node.appendChild(bind_node)

        # Inject note node inside <{self._root_tag_name}>
        instance_node = model_node.getElementsByTagName('instance')[0]
        instance_node = instance_node.getElementsByTagName(self._root_tag_name)[0]
        instance_node.appendChild(
            self._root_node.createElement(f'_{self._unique_id}__disclaimer')
        )

    def _add_disclaimer_input(
        self,
        translated: bool,
        disclaimers_dict: dict,
        default_language_code: str,
    ):
        """

        """
        body_node = self._root_node.getElementsByTagName('h:body')[0]
        disclaimer_input = self._root_node.createElement('input')
        disclaimer_input_label = self._root_node.createElement('label')
        disclaimer_input.setAttribute('appearance', 'kobo-disclaimer')
        disclaimer_input.setAttribute(
            'ref', f'/{self._root_tag_name}/_{self._unique_id}__disclaimer'
        )

        if translated:
            itext = f'/{self._root_tag_name}/_{self._unique_id}__disclaimer:label'
            disclaimer_input_label.setAttribute(
                'ref',
                f"jr:itext('{itext}')",
            )
        else:
            disclaimer_input_label.appendChild(
                self._root_node.createTextNode(
                    disclaimers_dict[default_language_code]
                )
            )

        disclaimer_input.appendChild(disclaimer_input_label)
        body_node.appendChild(disclaimer_input)

    def _add_translation_nodes(
        self, disclaimers_dict: dict, default_language_code: str
    ):
        """
        Add <itext> nodes to <instance> if translations are detected.
        Will add only translations that match form translations.
        """

        for n in self._root_node.getElementsByTagName('itext')[0].childNodes:
            if n.nodeType == Node.ELEMENT_NODE and n.tagName == 'translation':
                disclaimer_translation = self._root_node.createElement('text')
                disclaimer_translation.setAttribute(
                    'id',
                    f'/{self._root_tag_name}/_{self._unique_id}__disclaimer:label',
                )
                value = self._root_node.createElement('value')
                language = n.getAttribute('lang').lower().strip()
                if m := re.match(r'[^\(]*\(([a-z]{2,})\)', language):
                    language_code = m.groups()[0]
                else:
                    language_code = default_language_code

                value.appendChild(
                    self._root_node.createTextNode(
                        disclaimers_dict.get(
                            language_code,
                            disclaimers_dict.get(default_language_code)
                        )
                    )
                )
                disclaimer_translation.appendChild(value)
                n.appendChild(disclaimer_translation)

    def _get_disclaimers(self, asset: 'kpi.Asset') -> Optional[QuerySet]:

        # Order by '-asset_id' to ensure that default is overridden later if
        # an override exists for the same language. See `_get_translations()`

        disclaimers = (
            FormDisclaimer.objects.annotate(language_code=F('language__code'))
            .values('language_code', 'message', 'default', 'hidden')
            .filter(Q(asset__isnull=True) | Q(asset=asset))
            .order_by('-hidden', '-asset_id', 'language_code')
        )

        if not disclaimers:
            return

        return disclaimers

    def _get_translations(
        self, disclaimers: QuerySet
    ) -> Optional[tuple[bool, dict, str]]:
        """
        Detect whether the form is translated and return its value plus a dictionary
        of all available messages and the default language code.
        """

        # Do not go further if disclaimer must be hidden
        if disclaimers[0]['hidden']:
            return

        translated = '<itext>' in self._object.xml
        disclaimers_dict = {}
        default_language_code = None
        for d in disclaimers:
            disclaimers_dict[d['language_code']] = d['message']
            if d['default']:
                default_language_code = d['language_code']

        if not translated and not disclaimers_dict[default_language_code]:
            return

        return translated, disclaimers_dict, default_language_code
