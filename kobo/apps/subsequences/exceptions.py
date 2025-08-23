class InvalidAction(Exception):
    """
    The referenced action does not exist or was not configured for the given
    question XPath at the asset level
    """

    pass


class InvalidItem(Exception):
    """
    The referenced action does not contain a list of items
    """

    pass


class InvalidXPath(Exception):
    """
    The referenced question XPath was not configured for supplemental data at
    the asset level
    """

    pass
