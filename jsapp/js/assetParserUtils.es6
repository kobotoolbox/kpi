import {parsePermissions} from './utils';
var assign = require('react/lib/Object.assign');

function parseTags (asset) {
  return {
    tags: asset.tag_string.split(',').filter((tg) => { return tg.length > 1; })
  }
}

function parseResponsePermissions (resp) {
  var out = {};
  var pp = parsePermissions(resp.owner__username, resp.permissions);
  out.parsedPermissions = pp;
  out.access = (()=>{
    var viewers = {};
    var changers = {};
    var isPublic = false;
    pp.forEach(function(userPerm){
      if (userPerm.can.view) {
        viewers[userPerm.username] = true;
      }
      if (userPerm.can.change) {
        changers[userPerm.username] = true;
      }
      if (userPerm.username === 'AnonymousUser') {
        isPublic = !!userPerm.can.view;
      }
    });
    return {view: viewers, change: changers, ownerUsername: resp.owner__username, isPublic: isPublic};
  })()
  return out;
}

function parsed (asset) {
  return assign(asset,
      parseResponsePermissions(asset),
      parseTags(asset))
}

module.exports = {
  parseResponsePermissions: parseResponsePermissions,
  parseTags: parseTags,
  parsed: parsed,
};
