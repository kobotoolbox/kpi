import {
  parsePermissions,
  assign,
} from './utils';

function parseTags (asset) {
  return {
    tags: asset.tag_string.split(',').filter((tg) => { return tg.length > 1; })
  };
}

function parseResponsePermissions (resp) {
  var out = {};
  var pp = parsePermissions(resp.owner__username, resp.permissions);
  out.parsedPermissions = pp;

  var isPublic = !!resp.permissions.filter(function(pp_){
    return pp_.user__username === 'AnonymousUser';
  })[0];

  out.access = (()=>{
    var viewers = {};
    var changers = {};
    pp.forEach(function(userPerm){
      if (userPerm.can.view) {
        viewers[userPerm.username] = true;
      }
      if (userPerm.can.change) {
        changers[userPerm.username] = true;
      }
    });
    return {view: viewers, change: changers, ownerUsername: resp.owner__username, isPublic: isPublic};
  })();
  return out;
}

function parsed (asset) {
  return assign(asset,
      parseResponsePermissions(asset),
      parseTags(asset));
}

module.exports = {
  parseResponsePermissions: parseResponsePermissions,
  parseTags: parseTags,
  parsed: parsed,
};
