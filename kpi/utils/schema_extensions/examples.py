from importlib import import_module
from typing import Union


def generate_example_from_schema(schema: Union[dict, str]) -> dict:

    if isinstance(schema, str):
        module_path, var_name = schema.rsplit('.', 1)
        module = import_module(module_path)
        schema = getattr(module, var_name)

    if 'example' in schema:
        return schema['example']

    schema_type = schema.get('type')
    schema_format = schema.get('format')

    if schema_type == 'object':
        properties = schema.get('properties', {})
        return {
            key: generate_example_from_schema(value)
            for key, value in properties.items()
        }

    elif schema_type == 'array':
        item_schema = schema.get('items', {})
        return [generate_example_from_schema(item_schema)]

    elif schema_type == 'string':
        if schema_format == 'date':
            return '2024-01-01'
        elif schema_format == 'date-time':
            return '2024-01-01T12:00:00Z'
        return 'string'

    elif schema_type == 'integer':
        return 123

    elif schema_type == 'number':
        return 123.45

    elif schema_type == 'boolean':
        return True

    return None
