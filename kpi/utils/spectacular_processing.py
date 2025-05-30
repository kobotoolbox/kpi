def pre_processing_filtering(endpoints):

    filtered = []
    for path, path_regex, method, callback in endpoints:
        # Remove all endpoints not in 'api/v2/'
        if not path.startswith('/api/v1/'):
            filtered.append((path, path_regex, method, callback))

    return filtered
