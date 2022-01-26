import requests

from veritree.models import VeritreeOAuth2
from veritree.utils import parse_veritree_response

from veritree.utils import get_headers_for_veritree_request
from veritree.common_urls import SUBSITE_API

def get_org_planting_site_and_region_data(access_token: str, org_id: int):
    """
    This function returns all the country and site data (regions) associated with the org used
    in various forms ex. Socio-economic
    """
    regions_url = SUBSITE_API
    # An org found in the user_orgs object is always of type orgAccount
    
    params = {'org_id': org_id, 'org_type': 'orgAccount', 'page_size': 10000, 'include[]': 'planting_site.country', 'fields': 'forest_type.name'} 
    
    response = requests.get(regions_url, params=params, headers=get_headers_for_veritree_request(access_token))
    content = parse_veritree_response(response)
    # TODO: Follow the pagination here instead of just requesting a very large amount of regions
    if content:
        country_dict = {}
        for planting_site in content:
            try:
                country_name = planting_site['planting_site']['country']['name']
                forest_type = planting_site['forest_type']['name']
            except KeyError:
                continue # If planting site doesn't have a country we can't do anything with it anyways
            if country_name in country_dict:
                country_dict[country_name]['planting_sites'].append(planting_site['name'])
                country_dict[country_name]['forest_types'].add(forest_type)
            else:
                country_dict[country_name] = {'planting_sites': [planting_site['name']], 'forest_types': set([forest_type])}
        return country_dict
    else:
        response.raise_for_status()

def get_org_forest_species_types(access_token: str, org_id: int):
    forest_type_species_url = '{}/api/forest-type-species'.format(VeritreeOAuth2.ROOT_URL)
    # An org found in the user_orgs object is always of type orgAccount
    
    params = {'org_id': org_id, 'org_type': 'orgAccount', 'page_size': 10000 }
    response = requests.get(forest_type_species_url, params=params, headers=get_headers_for_veritree_request(access_token))
    content = parse_veritree_response(response)
    if content:
        forest_type_dict = {}
        for species in content:
            try:
                species_name = species['name']
                species_id = species['id']
                species_forest_type = species['forest_type']
            except KeyError:
                continue
            forest_type_dict[species_name] = {"id": species_id, "forest_type": species_forest_type["name"] }
        
        return forest_type_dict
    else:
        response.raise_for_status()