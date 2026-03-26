from __future__ import annotations

import re
from typing import Optional, Union
from xml.dom import Node
from xml.dom import minidom
from xml.etree import ElementTree as ET

from django.db.models import F, Q
from django.db.models.query import QuerySet
from lxml import etree

from kobo.apps.form_disclaimer.models import FormDisclaimer

# Goal for the future: all XML handling is done in this file. No other files
# import anything from xml, lxml, etc. directly; instead, they import helpers
# from this file.
#
# As of Python 3.8+ / lxml 4.6.2+, the standard library and lxml XML parsers
# are hardened against XXE, entity expansion bombs, and external DTD fetching
# by default, making defusedxml unnecessary for this project (Python 3.12,
# lxml 5.4).


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


def edit_submission_xml(
    xml_parsed: 'xml.etree.ElementTree.Element',
    path: str,
    value: str,
) -> None:
    """
    Edit submission XML with an XPath and new value, creating a new tree
    element if the path doesn't yet exist.
    """
    element = get_or_create_element(xml_parsed, path)
    element.text = value


def minidom_parsestring(text: Union[str, bytes]) -> minidom.Document:
    """
    Thin wrapper so callers don't import minidom directly for parsing.
    """
    return minidom.parseString(text)


def fromstring_preserve_root_xmlns(
    text: Union[str, bytes],
) -> ET.Element:
    """
    Parse an XML string, but leave the default namespace in the `xmlns`
    attribute if the root element has one, and do not use Clark notation
    prefixes on tag names for the default namespace.
    """
    parser = ET.XMLParser(
        target=OmitDefaultNamespacePrefixTreeBuilder(),
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
) -> str:
    """
    Returns a stripped version of `source`. It keeps only nodes provided in
    `nodes_to_keep`.
    If `rename_root_node_to` is provided, the root node will be renamed to the
    value of that parameter in the returned XML string.

    When `use_xpath=True`, `nodes_to_keep` must contain full hierarchical
    paths (e.g. `['group/question', 'simple_q']`). This routes to the faster
    `_filter_nodes_by_xpaths()` which builds paths incrementally and prunes
    subtrees early, avoiding per-node `tree.getpath()` calls.

    When `use_xpath=False` (default), `nodes_to_keep` contains plain tag
    names. The full path of each node is resolved against the submission tree.
    """
    # Force `source` to be bytes in case it contains an XML declaration
    # `etree` does not support strings with xml declarations.
    if isinstance(source, str):
        source = source.encode()

    xml_doc = etree.fromstring(source)
    tree = etree.ElementTree(xml_doc)
    root_element = tree.getroot()

    if nodes_to_keep and use_xpath:
        xpath_matches = [f"/{x.strip('/')}/" for x in nodes_to_keep]
        _filter_nodes_by_xpaths(root_element, xpath_matches)
    elif nodes_to_keep:
        root_path = tree.getpath(root_element)

        def remove_root_path(path_: str) -> str:
            return path_.replace(root_path, '')

        xpath_matches = []
        # Retrieve XPaths of all nodes we need to keep.
        for node_to_keep in nodes_to_keep:
            for node in tree.iter(node_to_keep):
                xpath_match = remove_root_path(tree.getpath(node))
                # Add a trailing slash to distinguish `subgroup1/` from
                # `subgroup11/` during the startswith check below.
                xpath_matches.append(f'{xpath_match}/')

        def process_node(node_: etree._Element, xpath_matches_: list):
            """
            Recursive bottom-up traversal. Children are processed before their
            parent so that a matched child can tag its parent as `do_not_delete`
            before the parent itself is evaluated.
            """
            for child in node_.getchildren():
                process_node(child, xpath_matches_)

            node_xpath = remove_root_path(tree.getpath(node_))

            if (
                not f'{node_xpath}/'.startswith(tuple(xpath_matches_))
                and node_.get('do_not_delete') != 'true'
            ):
                if node_ != root_element:
                    node_.getparent().remove(node_)
            elif node_xpath != '':
                node_.getparent().set('do_not_delete', 'true')

            if node_.attrib.get('do_not_delete'):
                del node_.attrib['do_not_delete']

        process_node(root_element, xpath_matches)

    if rename_root_node_to:
        tree.getroot().tag = rename_root_node_to

    return etree.tostring(
        tree,
        pretty_print=True,
        encoding='utf-8',
        xml_declaration=xml_declaration,
    ).decode()


def xml_tostring(el: ET.Element, **kwargs) -> str:
    """
    Thin wrapper around `ElementTree.tostring()` as a step toward a future
    where all XML handling is done in this file
    """
    if 'encoding' in kwargs:
        raise NotImplementedError(
            'Do not pass an `encoding` argument. The returned encoding is'
            ' always `unicode`.'
        )
    # "Use encoding="unicode" to generate a Unicode string (otherwise, a
    # bytestring is generated)."
    # https://docs.python.org/3.10/library/xml.etree.elementtree.html#xml.etree.ElementTree.tostring
    return ET.tostring(el, encoding='unicode', **kwargs)


def _filter_nodes_by_xpaths(root: etree._Element, xpath_matches: list) -> None:
    """
    Remove from `root` all descendant nodes that are neither a kept node nor
    an ancestor of a kept node, according to `xpath_matches`.

    Paths are built incrementally during traversal to avoid calling
    `tree.getpath()` on every node, which is O(depth) per call in lxml.
    The algorithm is iterative to avoid Python recursion limits on deeply
    nested XML.

    `xpath_matches` must contain absolute paths with a leading and trailing
    slash, e.g. `['/group/question/', '/simple_q/']`.
    """
    keep_prefixes = tuple(xpath_matches)

    # Pre-compute the set of all ancestor paths so the per-node ancestor check
    # is O(1) (set lookup) instead of O(N_fields) (linear scan).
    # For a kept path '/group/question/', the ancestors are '/group/'.
    ancestor_paths: set = set()
    for kp in xpath_matches:
        path = '/'
        for part in kp.strip('/').split('/')[:-1]:
            path = f'{path}{part}/'
            ancestor_paths.add(path)

    # Seed the stack with root's direct children. Root itself is never removed.
    stack = [(child, root, '/') for child in root]
    while stack:
        node, parent, parent_path = stack.pop()
        node_path = f'{parent_path}{node.tag}/'
        is_kept = node_path.startswith(keep_prefixes)
        is_ancestor = not is_kept and node_path in ancestor_paths
        if not is_kept and not is_ancestor:
            parent.remove(node)
        else:
            stack.extend((child, node, node_path) for child in node)


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

        # Use pre-fetched disclaimers when available (set by XFormListApi for
        # the formList endpoint) to avoid one query per form.
        if hasattr(asset, '_cached_disclaimers'):
            disclaimers = asset._cached_disclaimers
        else:
            disclaimers = (
                FormDisclaimer.objects.annotate(language_code=F('language__code'))
                .values('language_code', 'message', 'default', 'hidden')
                .filter(Q(asset__isnull=True) | Q(asset=asset))
                .order_by('-hidden', '-asset_id', 'language_code')
            )

        if not disclaimers:
            return None

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
