import type { AssetContentSettings, AssetResponse } from '#/dataInterface'
import type { Asset } from './api/models/asset'

export function parseTags(asset: Asset | AssetResponse) {
  return {
    tags: asset.tag_string?.split(',').filter((tg) => tg.length !== 0) || [],
  }
}

function parseSettings(asset: Asset | AssetResponse) {
  const settings = asset.content && asset.content.settings
  if (settings) {
    const foundSettings: AssetContentSettings = Array.isArray(settings) ? (settings[0] ?? {}) : settings
    return {
      unparsed__settings: foundSettings,
      settings__style: foundSettings.style,
      settings__form_id: foundSettings.form_id,
      settings__title: foundSettings.title,
    }
  } else {
    return {}
  }
}

export function parsed(asset: Asset | AssetResponse): AssetResponse {
  return Object.assign(asset, parseSettings(asset), parseTags(asset)) as AssetResponse
}
