from typing import Optional
from xml.etree.ElementTree import ParseError

from kpi.utils.log import logging
from kpi.utils.xml import fromstring_preserve_root_xmlns


def extract_confirmation_message(xml_string: str) -> Optional[str]:
    """
    Extracts the confirmation message from the XML string based on the
    `kobo:submitMessage` attribute.
    """
    try:
        root = fromstring_preserve_root_xmlns(xml_string)
    except ParseError:
        logging.error(
            'Failed to parse XML for confirmation message', exc_info=True
        )
        return

    # Extract the kobo:submitMessage attribute from the root element
    confirmation_message_xpath = root.attrib.get('{http://kobotoolbox.org/xforms}submitMessage')

    if not confirmation_message_xpath:
        return

    _, submit_message_root_tag, *other_parts = (
        confirmation_message_xpath.split('/')
    )
    confirmation_message_xpath = './' + '/'.join(other_parts)

    # Evaluate the XPath expression to find the message
    confirmation_message_element = root.find(confirmation_message_xpath)

    if confirmation_message_element is None:
        logging.error('Failed to extract confirmation message')
    else:
        return confirmation_message_element.text

    return
