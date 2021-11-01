import unicodecsv as csv
import requests
from io import BytesIO
from django.core.files.base import ContentFile
from django.core.exceptions import ObjectDoesNotExist
from veritree.models import VeritreeOAuth2
from kpi.serializers.v2.asset_file import AssetFileSerializer

from django.contrib.auth.models import User
from kpi.models import Asset

def generate_org_csv_for_user_and_asset(user: User, asset: Asset, veritree_org_id = 1) -> bool:
    target_file_name = 'org_data.csv'

    if not user or not asset:
        raise TypeError('TypeError None type for user or asset, cannot generate org csv for user')
    
    try:
        veritree_data = user.social_auth.get(provider=VeritreeOAuth2.name).extra_data
        veritree_access_token = veritree_data['access_token']
    except ObjectDoesNotExist:
        raise TypeError('TypeError user social auth does not exist with veritree')

    if not veritree_access_token:
        raise ValueError('ValueError no access token for user')
    
    try:
        veritree_orgs = veritree_data['user_orgs']
        if int(veritree_org_id) not in [veritree_org['org_id'] for veritree_org in veritree_orgs]:
            raise ValueError('ValueError User does not have access to organization id {}'.format(veritree_org_id))
    except (IndexError, KeyError, TypeError):
        raise Exception('Exception No orgs for this user')

    csv_buffer = generate_csv_for_org(get_org_csv_data(veritree_access_token, veritree_org_id))
    serializer_data = {
        'description': 'generated csv for org',
        'file_type': 'form_media',
        'metadata': {
            'filename': target_file_name,
        },
        'content': ContentFile(csv_buffer.getvalue(), name=target_file_name),
    }
    
    serialized = AssetFileSerializer(data=serializer_data)
    if serialized.is_valid(raise_exception=True):
        #Delete old file with the same name
        try:
            existing_file = asset.asset_files.get(metadata__contains={'filename': target_file_name})
            existing_file.delete(force=True)
        except ObjectDoesNotExist:
            pass
        serialized.save(asset=asset, user=user)
    else:
        raise Exception('Serializer is not valid, programming error')


def get_headers_for_veritree_request(access_token: str):
    headers = {'Authorization': 'Bearer {}'.format(access_token)}
    return headers

def get_org_csv_data(access_token: str, orgId: int):
    """
    This function returns all the country and site data (regions) associated with the org used
    in various forms ex. Socio-economic
    """
    regions_url = '{}/api/regions'.format(VeritreeOAuth2.ROOT_URL)
    # An org found in the user_orgs object is always of type orgAccount
    
    params = {'org_id': orgId, 'org_type': 'orgAccount', 'page_size': 10000, 'fields': 'country.name'} 
    
    response = requests.get(regions_url, params=params, headers=get_headers_for_veritree_request(access_token))
    
    # TODO: Follow the pagination here instead of just requesting a very large amount of regions
    if response.status_code == 200:
        try:
            content = response.json()['data']
        except KeyError:
            raise KeyError('KeyError shape of response is not as expected')
        
        country_dict = {}
        for region in content:
            if region['country']['name'] in country_dict:
                country_dict[region['country']['name']].append(region['name'])
            else:
                country_dict[region['country']['name']] = [region['name']]
        return country_dict
    else:
        response.raise_for_status()

def generate_csv_for_org(data: dict) -> BytesIO:
    """
    Form of data should be a dict of form {"countryName": [<list of region names>]}

    returns a csv of choices, formatted in a standard way so that kobo can use them
    """
    csv_headers = ['list_name', 'name', 'label::English (en)'] #TODO: dynamically find out which languages to use
    nation_list_name = 'Nation'
    # Translations will have to be handled manually
    # TODO: use existing translations for other languages so that we don't wipe them out
    # The translations will be contained inside the CSV ideally
    def make_row(list_name: str, name: str):
        #TODO: remove commas from 
        formatted_name = name.replace(',', '-')
        row = [list_name, formatted_name.lower()]
        for header in csv_headers[2:]:
            row.append(formatted_name) 
        return row

    data_list = [[]]
    for nation, regions in data.items():
        data_list[0].append(make_row(nation_list_name, nation))
        data_list.append([make_row('{}_sites'.format(nation.lower()), region) for region in regions])

    buffer = BytesIO()
    csv_writer = csv.writer(buffer, encoding='utf-8')
    csv_writer.writerow(csv_headers)
    for choice_list in data_list:
        csv_writer.writerows(choice_list)
    
    return buffer
