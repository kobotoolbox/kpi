from __future__ import annotations


def nested_dict_from_keys(dict_: dict) -> dict:
    """
    Transforms a dictionary with keys containing slashes into a nested
    dictionary structure.
    """

    result = {}

    for key, value in dict_.items():
        keys = key.split('/')
        sub_dict = result
        for sub_key in keys[:-1]:
            if sub_key not in sub_dict:
                sub_dict[sub_key] = {}
            sub_dict = sub_dict[sub_key]

        if isinstance(value, list):
            sub_dict[keys[-1]] = [
                {
                    sub_key.split('/')[-1]: sub_val
                    for sub_key, sub_val in item.items()
                }
                for item in value if item
            ]
        else:
            sub_dict[keys[-1]] = (
                nested_dict_from_keys(value)
                if isinstance(value, dict)
                else value
            )

    return result
