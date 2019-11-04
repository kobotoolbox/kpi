from tldextract import extract

def get_subdomain(request):
    full_uri_with_path = request.build_absolute_uri()
    extracted_full_uri_with_path = extract(full_uri_with_path)
    subdomain = extracted_full_uri_with_path.subdomain.split('.')[0]
    return subdomain