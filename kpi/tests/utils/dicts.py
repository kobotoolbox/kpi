from __future__ import annotations


def convert_hierarchical_keys_to_nested_dict(dict_: dict) -> dict:
    """
    Converts a dictionary with flat keys containing slashes into a nested dictionary.

    This function takes a dictionary where keys represent a hierarchical path,
    separated by slashes (e.g., "level1/level2/level3"), and converts it into
    a nested dictionary structure. Each part of the key becomes a level in the
    resulting dictionary.
    """
    result = {}

    for key, value in dict_.items():
        # Split the key to get each level of hierarchy
        keys = key.split('/')
        sub_dict = result

        # Traverse each part of the key except the last one to build the nested
        # structure.
        #
        # Example:
        # In keys = ['a', 'b', 'c'], the sub-keys 'a' and 'b' represent intermediate
        # levels in the nested dictionary structure, while 'c' is the last part,
        # which corresponds to the point where we will actually assign the value
        # and the appropriate depth we want.
        for part in keys[:-1]:
            if part not in sub_dict:
                # Create an empty dictionary if the part does not exist
                sub_dict[part] = {}
            # Move deeper into the current level of the dictionary
            sub_dict = sub_dict[part]

        # Handle the final part of the key
        if isinstance(value, list):
            # If the value is a list, make sure the corresponding key exists as a list
            if keys[-1] not in sub_dict:
                sub_dict[keys[-1]] = []

            # Iterate over each item in the list
            for item in value:
                if isinstance(item, dict):
                    # Clean the dictionary item and append it to the list
                    sub_dict[keys[-1]].append(_clean_keys(item))
                else:
                    # Append non-dictionary items directly to the list
                    sub_dict[keys[-1]].append(item)
        else:
            # Assign the value directly for non-list items
            sub_dict[keys[-1]] = value

    return result


def _clean_keys(dict_: dict) -> dict:
    """
    Removes the redundant parent segments from keys in a dictionary,
    keeping only relevant parts for hierarchical nesting.
    """

    cleaned_dict = {}

    for key, value in dict_.items():
        # Get the last segment of the key after the last slash (see example
        # in `convert_flat_keys_to_nested_dict` for more details).
        cleaned_key = key.split('/')[-1]

        # Handle lists of dictionaries recursively
        if isinstance(value, list):
            cleaned_list = []
            for item in value:
                if isinstance(item, dict):
                    # Recursively clean each dictionary in the list
                    cleaned_list.append(_clean_keys(item))
                else:
                    # Append non-dictionary items directly to the cleaned list
                    cleaned_list.append(item)
            # Store the cleaned list under the cleaned key
            cleaned_dict[cleaned_key] = cleaned_list
        # Handle nested dictionaries recursively
        elif isinstance(value, dict):
            cleaned_dict[cleaned_key] = _clean_keys(value)
        else:
            # Assign the value directly if it is not a dictionary or list
            cleaned_dict[cleaned_key] = value

    return cleaned_dict
