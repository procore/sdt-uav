import util from './util';
import uav from './uav';
import parseHtml from './parse/html';
import model from './model';
import component from './component';

/**
 * Polyfill Array.from for IE. The Babel polyfill
 * for spread syntax is too verbose.
 */
if (!Array.from) {

    Array.from = function(object) {

        return [].slice.call(object);

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
uav.parse = parseHtml;
uav.setTag = util.setTag;

window.uav = uav;
