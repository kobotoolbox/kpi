def pre_processing_filtering(endpoints):
    filtered = []
    seen = []

    for path, path_regex, method, callback in endpoints:
        # Remove all endpoints not in 'api/v2/'
        if path.startswith('/api/v1/'):
            continue

        normalized_path = path.rstrip('/')
        if (normalized_path, method) in seen:
            continue

        seen.append((normalized_path, method))
        filtered.append((path, path_regex, method, callback))

    return filtered
