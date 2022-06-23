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

def get_headers_for_veritree_request(access_token: str):
    headers = {'Authorization': 'Bearer {}'.format(access_token)}
    return headers

def get_veritree_default_org_params(org_id: int) -> dict:
    return { "org_type": "orgAccount", "org_id": org_id }