from requests import Response

def parse_veritree_response(response: Response):
    """
    Util function for parsing any standardized veritree response.

    Raises exception if an HTTP Error occurs
    """
    response.raise_for_status()
    try:
        content = response.json()
    except Exception:
        raise Exception('Exception JSON is not included on the response')
    RESULT_KEY = '_result'
    
    if RESULT_KEY in content and 'http_code' in content[RESULT_KEY]:
        http_code = content[RESULT_KEY]['http_code']
        if http_code >= 200 and http_code < 300:
            return content['data']
    # Response must not be in an envelope, return the json
    return content
