# Util functions
def format_question_name(site_name) -> str:
    return site_name.strip().replace(' ', '_').replace(',', '-')

def unformat_question_name(site_name: str) -> str:
    return site_name.replace('_', ' ').replace('-', ',')