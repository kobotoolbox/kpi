import React from 'react';
import packageJson from '../../package.json';
global.appVersion = packageJson.version;

// version from `meta.json` - first param
// version in bundle file - second param
const semverGreaterThan = (versionA, versionB) => {
    const versionsA = versionA.split(/\./g);
  
    const versionsB = versionB.split(/\./g);
    while (versionsA.length || versionsB.length) {
      const a = Number(versionsA.shift());
  
      const b = Number(versionsB.shift());
      // eslint-disable-next-line no-continue
      if (a === b) continue;
      // eslint-disable-next-line no-restricted-globals
      return a > b || isNaN(b);
    }
    return false;
  };

  export default class CacheBuster extends React.Component {
    constructor(props) {
      super(props);
      this.state = {
        loading: true,
        isLatestVersion: false,
        refreshCacheAndReload: () => {
          console.log('Clearing cache and hard reloading...')
          if ('caches' in window && caches) {
            // Service worker cache should be cleared with caches.delete()
            caches.keys().then(function(names) {
              for (let name of names) caches.delete(name);
            });
          }
          // delete browser cache and hard reload
          window.location.reload();
        }
      };
    }
  
    componentDidMount() {
      fetch('/meta.json')
        .then((response) => ({ "version": "0.1.1" }))// response.json())
        .then((meta) => {
          const latestVersion = meta.version;
          const currentVersion = global.appVersion;
        
          const shouldForceRefresh = semverGreaterThan(latestVersion, currentVersion);
          if (shouldForceRefresh) {
            console.log(`We have a new version - ${latestVersion}. Should force refresh`);
            this.setState({ loading: false, isLatestVersion: false });
          } else {
            console.log(`You already have the latest version - ${latestVersion}. No cache refresh needed.`);
            this.setState({ loading: false, isLatestVersion: true });
          }
        });
    }
  
    render() {
      return null;
    }
  }