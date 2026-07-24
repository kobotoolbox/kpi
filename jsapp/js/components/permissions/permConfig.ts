import Reflux from 'reflux'
import type { PermissionDefinition } from '#/dataInterface'
import type { PermissionCodename } from './permConstants'

/**
 * @deprecated migrate to react-query whenever you need to adjust things beyond simple rename
 */
class PermConfigStore extends Reflux.Store {
  permissions: PermissionDefinition[] = []

  public setPermissions(permissions: PermissionDefinition[]) {
    this.permissions = permissions
  }

  public getPermissionByCodename(wantedCodename: PermissionCodename) {
    this.verifyReady()
    return this.permissions.find((perm) => perm.codename === wantedCodename)
  }

  public getPermission(wantedUrl: string) {
    this.verifyReady()
    return this.permissions.find((perm) => perm.url === wantedUrl)
  }

  /**
   * Throws if trying to use permConfig before it fetches data from BE or if
   * data given by `setPermissions` is not an array.
   */
  private verifyReady() {
    if (!this.isReady()) {
      throw new Error('Permission config is not ready or failed to initialize!')
    }
  }

  public isReady() {
    return Array.isArray(this.permissions) && this.permissions.length !== 0
  }
}

/**
 * NOTE: this store relies on the app being initialized by calling
 * `actions.permissions.getConfig()` and then manually setting results here,
 * otherwise expect `verifyReady` to throw
 *
 * @deprecated migrate to react-query whenever you need to adjust things beyond simple rename
 */
const permConfig = new PermConfigStore()

export default permConfig
