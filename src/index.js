import util from './util';
import uav from './uav';
import model from './model';
import component from './component';

/**
 * Polyfill Array.from for IE. The Babel polyfill
 * for spread syntax is too verbose.
 */
if (!Array.from) {

    Array.from = function(object) {

        return object ? [].slice.call(object) : [];

    };

}

/**
 * Set the default template syntax.
 */
util.setTag('{', '}');

/**
 * Export public methods.
 */
uav.component = component;
uav.model = model;
uav.setTag = util.setTag;
uav.unbind = util.unbind;

window.uav = uav;

if (typeof module !== 'undefined' && module.exports) {

    module.exports = uav;

}
