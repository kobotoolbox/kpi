/** 
 * Workaround for 
 * https://github.com/remix-run/react-router/issues/8139
 * Also allows for history.listen(this.onRouteChange.bind(this));
 * Don't use this for new code!
 */
import {createHashHistory} from 'history';

export const history = createHashHistory({window});
