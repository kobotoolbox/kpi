# coding: utf-8
import re
from typing import Optional, Union
from lxml import etree


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

    def get_xpath_matches():
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
        xpath_matches = get_xpath_matches()
        process_node(root_element, xpath_matches)

    if rename_root_node_to:
        tree.getroot().tag = rename_root_node_to

    return etree.tostring(
        tree,
        pretty_print=True,
        encoding='utf-8',
        xml_declaration=xml_declaration,
    ).decode()


def add_xml_declaration(xml_content: Union[str, bytes]) -> Union[str, bytes]:
    xml_declaration = '<?xml version="1.0" encoding="utf-8"?>'
    # Should support ̀ lmxl` and `dicttoxml`
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

    xml_ = f'{xml_declaration}\n{xml_content_as_str}'
    if use_bytes:
        return xml_.encode()
    return xml_
