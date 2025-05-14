from drf_spectacular.utils import inline_serializer
from rest_framework import serializers


def inline_serializer_class(name: str, fields: dict) -> type[serializers.Serializer]:
    """
    Dynamically creates and returns a DRF serializer class with the given name and fields.  # noqa

    Args:
        name (str): The name to assign to the dynamically created serializer class.
        fields (dict): A dictionary mapping field names to serializer fields (e.g., {'id': serializers.IntegerField()}).  # noqa

    Returns:
        type[serializers.Serializer]: A new serializer class with the specified name and fields.  # noqa
    """
    instance = inline_serializer(name=name, fields=fields)
    return type(instance)
