def replace_placeholders(message, **placeholders):
    """
    Formats a message by replacing placeholders (e.g., ##placeholder##) with
    provided values.

    Args:
        message (str): The message string with placeholders.
        **kwargs: Placeholder-value pairs.

    Returns:
        str: The formatted message with placeholders replaced by their
        respective values.
    """
    for key, value in placeholders.items():
        placeholder = f'##{key}##'
        message = message.replace(placeholder, value)
    return message
