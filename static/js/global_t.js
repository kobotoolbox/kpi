// This is a global t() function for handling translations. I moved it out
// of webpack config, as webpack turned out to be chaotic-evil in this case. —Leszek

// John moved it to this silly little file so that we could use CSP to prohibit
// inline scripts

window.t = function(str) {
  if (window.gettext) {
    return window.gettext(str);
  } else {
    return str;
  }
};
