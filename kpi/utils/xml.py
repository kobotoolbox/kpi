# coding: utf-8
from __future__ import annotations

import re
from typing import Optional, Union, List
from xml.dom import Node

from defusedxml import minidom
from django.db.models import F, Q
from django.db.models.query import QuerySet
from django_request_cache import cache_for_request
from lxml import etree
from shortuuid import ShortUUID

from kobo.apps.form_disclaimer.models import FormDisclaimer


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


def get_path(parts: List[str], start: int = 0, end: int = None) -> str:
    return '/'.join(parts[start:end])


def edit_submission_xml(
    xml_parsed: etree._Element,
    path: str,
    value: str,
) -> None:
    """
    Edit submission XML with an XPath and new value, creating a new tree
    element if the path doesn't yet exist.
    """
    element = xml_parsed.find(path)
    if element is None:
        path_parts = path.split('/')
        # Construct the tree of elements, one node at a time
        for i, node in enumerate(path_parts):
            element = xml_parsed.find(get_path(path_parts, end=i + 1))
            if element is None:
                parent = (
                    xml_parsed
                    if i == 0
                    else xml_parsed.find(get_path(path_parts, end=i))
                )
                element = etree.SubElement(parent, node)
    element.text = value


class XMLFormWithDisclaimer:

    # TODO support XForm when Kobocat becomes a Django-app
    def __init__(self, obj: Union['kpi.AssetSnapshot']):
        self._object = obj
        self._unique_id = obj.asset.uid
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
            'nodeset', f'/{self._unique_id}/_{self._unique_id}__disclaimer'
        )
        bind_node.setAttribute('readonly', 'true()')
        bind_node.setAttribute('required', 'false()')
        bind_node.setAttribute('type', 'string')
        bind_node.setAttribute('relevant', 'false()')
        model_node.appendChild(bind_node)

        # Inject note node inside <{self._unique_id}>
        instance_node = model_node.getElementsByTagName('instance')[0]
        instance_node = instance_node.getElementsByTagName(self._unique_id)[0]
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
            'ref', f'/{self._unique_id}/_{self._unique_id}__disclaimer'
        )

        if translated:
            itext = f'/{self._unique_id}/_{self._unique_id}__disclaimer:label'
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

        translation_nodes = []
        languages = []
        for n in self._root_node.getElementsByTagName('itext')[0].childNodes:
            if n.nodeType == Node.ELEMENT_NODE and n.tagName == 'translation':
                languages.append(n.getAttribute('lang'))
                translation_nodes.append(n)
                disclaimer_translation = self._root_node.createElement('text')
                disclaimer_translation.setAttribute(
                    'id',
                    f'/{self._unique_id}/_{self._unique_id}__disclaimer:label',
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

        # Do not go further is disclaimer must be hidden
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
