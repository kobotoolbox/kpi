from typing import Optional, Union


class StandardizeSearchableFieldMixin:

    def standardize_json_field(
        self,
        field_name: str,
        property_name: str,
        property_type: Union[str, list, dict],
        default: Optional[Union[str, list, dict]] = None,
    ):
        field = getattr(self, field_name)
        try:
            value = field.get(property_name)
        except AttributeError:
            # JSONB Field contains a string instead of a json
            field = {}
            value = ''

        if property_type is list:
            if not value or value == [None] or isinstance(value, str):
                value = default if default else []
            elif isinstance(value, dict):
                value = default if default else [value]
        elif property_type is dict:
            if not value or isinstance(value, str) or value == [None]:
                value = default if default else {}
        elif property_type is str:
            if value is None:
                value = default if default else ""
        else:
            raise NotImplementedError

        field[property_name] = value
        setattr(self, field_name, field)

    def standardize_field(self, field_name: str, default, allows_null=True):
        value = getattr(self, field_name)

        if not value:
            if allows_null and value is None:
                return

            setattr(self, field_name, default)
