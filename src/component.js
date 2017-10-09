import parseHtml from './parse/html';
import parseElement from './parse/element';
import model from './model';
import util from './util';
import uav from './uav';

/**
 * A component consists of an HTML tree bound
 * to an array or object. 
 * 
 * @param  {String|Element} html   - the component's template
 * @param  {Object|Array}   vm     - the view model
 * @param  {String|Element} parent - the element in which to insert the component (optional)
 * @param  {Function}       cb     - a callback, passed the rendered root element (optional)
 * @return {Object|Array}   vm
 */
export default function(html, vm, parent) {

    const node = html.tagName ? html : parseHtml(html);

    const steps = parseElement(node);

    vm = model(vm);

    vm._el = util.render(steps, vm);

    if (parent) {

        if (typeof parent === 'string') {

            parent = uav(parent);

        }

        if (parent.tagName) {

            uav.unbind(parent.firstElementChild);

            parent.innerHTML = '';

            parent.appendChild(vm._el);

        }

    }

    for (let i = 1; i < arguments.length; i++) {
    
        if (typeof arguments[i] === 'function') {

            setTimeout(() => arguments[i](vm._el));

            break;

        }

    }

    return vm;

}
