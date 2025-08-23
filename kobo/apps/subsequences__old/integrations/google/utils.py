import json

import constance
from google.oauth2.service_account import Credentials


def google_credentials_from_json_string(json_str):
    return Credentials.from_service_account_info(json.loads(json_str))

def google_credentials_from_constance_config():
    if json_str := constance.config.ASR_MT_GOOGLE_CREDENTIALS:
        return google_credentials_from_json_string(json_str)
    else:
        return None
