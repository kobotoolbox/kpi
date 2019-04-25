import {
  parsePermissions,
  assign,
} from './utils';

function parseTags (asset) {
  return {
    tags: asset.tag_string.split(',').filter((tg) => { return tg.length !== 0; })
  };
}

function parseResponsePermissions (resp) {
  var out = {};
  parsePermissions(resp.owner__username, resp.permissions);
  // TODO: simplify the call to parse Permissions, here we only need to include user__username for each permission

  // out.parsedPermissions = pp;

  // var isPublic = !!resp.permissions.filter(function(pp_){
  //   return pp_.user__username === 'AnonymousUser';
  // })[0];

  // out.access = (()=>{
  //   var viewers = {};
  //   var changers = {};
  //   pp.forEach(function(userPerm){
  //     if (userPerm.can.view) {
  //       viewers[userPerm.username] = true;
  //     }
  //     if (userPerm.can.change) {
  //       changers[userPerm.username] = true;
  //     }
  //   });
  //   return {view: viewers, change: changers, ownerUsername: resp.owner__username, isPublic: isPublic};
  // })();
  return out;
}

function parseSettings (asset) {
  var settings = asset.content && asset.content.settings;
  if (settings) {
    if (settings.length) {
      settings = settings[0];
    }
    return {
      unparsed__settings: settings,
      settings__style: settings.style !== undefined ? settings.style : '',
      settings__title: settings.title,
      settings__version: settings.version !== undefined ? settings.version : '',
      settings__form_id: settings.form_id !== undefined ? settings.form_id : (settings.id_string !== undefined ? settings.id_string : '')
    };
  } else {
    return {};
  }
}

function parsed (asset) {
  return assign(asset,
      parseSettings(asset),
      parseResponsePermissions(asset),
      parseTags(asset));
}

module.exports = {
  parseResponsePermissions: parseResponsePermissions,
  parseTags: parseTags,
  parsed: parsed,
};
