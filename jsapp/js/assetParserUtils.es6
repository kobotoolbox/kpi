import {assign} from 'utils';

export function parseTags (asset) {
  return {
    tags: asset.tag_string.split(',').filter((tg) => { return tg.length !== 0; })
  };
}

function parseSettings (asset) {
  var settings = asset.content && asset.content.settings;
  if (settings) {
    if (settings.length) {
      settings = settings[0];
    }
    return {
      unparsed__settings: settings,
      settings__style: settings.style,
      settings__form_id: settings.form_id,
      settings__title: settings.title,
    };
  } else {
    return {};
  }
}

export function parsed (asset) {
  return assign(asset,
      parseSettings(asset),
      parseTags(asset));
}
