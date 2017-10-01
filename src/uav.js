/**
 * Select all nodes that match the given selector, 
 * and either run a callback on each, or return them
 * in an array.
 * 
 * @param  {String}   selector - a CSS selector
 * @param  {Function} callback - a callback for each element (optional)
 * @return {Array}             - an array of elements
 */
function all(selector, callback) {

    const els = Array.from(document.querySelectorAll(selector));

    if (callback) {

        els.forEach(callback);

    }

    return els;

}

/**
 * Select one or all elements that match the given selector.
 * 
 * @param  {String}   selector - a CSS selector
 * @param  {Function} callback - a callback for each element (optional)
 * @return {Element|Array}     - the selected node(s)
 */
function uav(selector, callback) {

    if (callback) {

        return all(selector, callback);

    }

    return document.querySelector(selector) || document.createElement('div');

}

uav.all = all;

export default uav;
