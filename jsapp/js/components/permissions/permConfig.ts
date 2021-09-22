import Reflux from 'reflux';

class PermConfigStore extends Reflux.Store {
  permissions: PermissionDefinition[] = []

  public setPermissions(permissions: PermissionDefinition[]) {
    this.permissions = permissions;
  }

  public getPermissionByCodename(wantedCodename: string) {
    this.verifyReady();
    return this.permissions.find((perm) => perm.codename === wantedCodename);
  }

  public getPermission(wantedUrl: string) {
    this.verifyReady();
    return this.permissions.find((perm) => perm.url === wantedUrl);
  }

  /**
   * Throws if trying to use permConfig before it fetches data from BE or if
   * data given by `setPermissions` is not an array.
   */
  private verifyReady() {
    if (!this.isReady()) {
      throw new Error(t('Permission config is not ready or failed to initialize!'));
    }
  }

  public isReady() {
    return Array.isArray(this.permissions) && this.permissions.length !== 0;
  }
}

/**
 * NOTE: this store relies on the app being initialized by calling
 * `actions.permissions.getConfig()` and then manually setting results here,
 * otherwise expect `verifyReady` to throw
 */
const permConfig = new PermConfigStore();

export default permConfig;
