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

    const node = parseHtml(html.innerHTML || html);

    if (!vm) {

        return node;

    }

    /**
     * parseElement returns a list of functions called "steps"
     * that, when run in sequence, construct a data-bound clone
     * of the node.
     */
    const steps = parseElement(node);

    /**
     * Running an object through the model function adds getters
     * and setters to all of its properties, to support data binding.
     */
    vm = model(vm);

    /**
     * util.render runs the steps we created above.
     */
    vm._el = util.render(steps, vm);

    /**
     * Now we can insert the bound element into the DOM.
     */
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

    /**
     * If any argument is a function, pass it the
     * component's bound element.
     */
    for (let i = 1; i < arguments.length; i++) {
    
        if (typeof arguments[i] === 'function') {

            setTimeout(() => arguments[i](vm._el));

            break;

        }

    }

    return vm;

}
