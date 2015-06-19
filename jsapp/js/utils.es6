import moment from 'moment';

export function notify(msg, atype='success') {
  alertify.notify(msg, atype);
}

export function formatTime(timeStr) {
  var _m = moment(timeStr);
  return _m.fromNow();
}

export var anonUsername = 'AnonymousUser';
export function getAnonymousUserPermission(permissions) {
  return permissions.filter(function(perm){
    return perm.user__username === anonUsername;
  })[0];
}

export function parsePermissions(owner, permissions) {
  var users = [];
  var perms = {};
  permissions && permissions.map((perm) => {
    perm.user__username = perm.user.match(/\/users\/(.*)\//)[1];
    return perm;
  }).filter((perm)=> {
    return ( perm.user__username !== owner && perm.user__username !== anonUsername);
  }).forEach((perm)=> {
    if(users.indexOf(perm.user__username) === -1) {
      users.push(perm.user__username);
      perms[perm.user__username] = [];
    }
    perms[perm.user__username].push(perm);
  });
  return users.map((username)=>{
    return {
      username: username,
      can: perms[username].reduce((cans, perm)=> {
        var permCode = perm.permission.split('_')[0];
        cans[permCode] = perm;
        return cans;
      }, {})
    };
  });
}


export var log = (function(){
  var log = function(...args) {
    console.log.apply(console, args);
    return args[0];
  };
  log.profileSeconds = function(n=1) {
    console.profile();
    window.setTimeout(function(){
      console.profileEnd();
    }, n * 1000);
  }
  return log;
})();
window.log = log;


var __strings = [];
// t will start out as a placeholder for a translation method
export var t = function (str) {
  if (__strings.indexOf(str) === -1) {
    __strings.push(str);
  }
  return str;
};

log.t = function () {
  console.log(JSON.stringify(__strings, null, 4));
}
