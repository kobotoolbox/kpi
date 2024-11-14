from lxml import etree
from typing import Optional

from kpi.utils.log import logging


def extract_confirmation_message(xml_string: str) -> Optional[str]:
    """
    Extracts the confirmation message from the XML string based on the
    `kobo:submitMessage` attribute.
    """
    if isinstance(xml_string, str):
        xml_string = xml_string.encode('utf-8')
    parser = etree.XMLParser(recover=True)
    root = etree.fromstring(xml_string, parser=parser)

    namespaces = root.nsmap

    # Extract the kobo:submitMessage attribute from the root element
    try:
        confirmation_message_xpath = root.xpath(
            '@kobo:submitMessage', namespaces=namespaces
        )
    except (etree.XPathEvalError, TypeError):
        return

    if not confirmation_message_xpath:
        return

    confirmation_message_xpath = confirmation_message_xpath[0].strip()
    _, submit_message_root_tag, *other_parts = (
        confirmation_message_xpath.split('/')
    )
    confirmation_message_xpath = f'/{root.tag}/' + '/'.join(other_parts)

    try:
        # Evaluate the XPath expression to find the message
        confirmation_message_element = root.xpath(confirmation_message_xpath)
    except etree.XPathEvalError as e:
        logging.error(
            'Failed to extract confirmation message: ' + str(e),
            exc_info=True
        )
    else:
        if confirmation_message_element:
            return confirmation_message_element[0].text

    return
