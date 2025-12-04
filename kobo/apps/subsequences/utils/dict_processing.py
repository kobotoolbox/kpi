from typing import Any


# see https://stackoverflow.com/questions/13687924/setting-a-value-in-a-nested-python-dictionary-given-a-list-of-indices-and-value  # noqa
# It's not the most robust version but it's good enough for our purposes
def nested_set(original: dict, key_path: tuple[str], value: Any):
    for key_str in key_path[:-1]:
        original = original.setdefault(key_str, {})
    original[key_path[-1]] = value
