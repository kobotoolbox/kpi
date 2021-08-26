import {assign} from 'js/utils';

export function parseTags(asset: AssetResponse) {
  return {
    tags: asset.tag_string.split(',').filter((tg) => { return tg.length !== 0; })
  };
}

function parseSettings(asset: AssetResponse) {
  const settings = asset.content && asset.content.settings;
  if (settings) {
    let foundSettings: AssetContentSettings = {};
    if (Array.isArray(settings) && settings.length) {
      foundSettings = settings[0];
    }
    return {
      unparsed__settings: foundSettings,
      settings__style: foundSettings.style,
      settings__form_id: foundSettings.form_id,
      settings__title: foundSettings.title,
    };
  } else {
    return {};
  }
}

export function parsed(asset: AssetResponse): AssetResponse {
  return assign(
    asset,
    parseSettings(asset),
    parseTags(asset)
  ) as AssetResponse;
}
