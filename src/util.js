import uav from './uav';

const util = {

    /**
     * Add a non-enumerable property to the given object
     * 
     * @param  {Object} obj   - the target
     * @param  {String} prop  - the name of the property
     * @param  {any} value    - the value of the property
     * @return {Object}       - the target
     */
    defineProp: (obj, prop, value) => Object.defineProperty(obj, prop, {
        value,
        configurable: true,
        writable: true,
        enumerable: false
    }),

    /**
     * Remove any bindings associated with
     * the given DOM node and its children.
     * 
     * @param  {Element} node - the node to unbind
     * @return {undefined}
     */
    unbind(node) {

        if (node && node._uav) {

            Array.from(node.children).forEach(util.unbind);

            node._uav.forEach(fn => fn());

            node = null;

        }

    },

    /**
     * Set the template tag syntax.
     * Because it is used as a regular expression,
     * special characters should be escaped.
     * 
     * @param {String} open  - the opening tag
     * @param {String} close - the closing tag
     */
    setTag(open, close) {

        uav.tagRX = new RegExp(`(^${open}|${close}$)`, 'g');

        uav.expRX =  new RegExp(`(${open}.*?${close})`, 'g');

    },

    /**
     * Remove any template tag characters from a string
     * 
     * @param  {String} str - the string to change
     * @return {String}
     */
    stripTags: str => str.replace(uav.tagRX, ''),

    /**
     * Run the given binding with the given state,
     * creating a reference on uav.state so that
     * any model properties accessed during evaluation
     * will create new bindings.
     * 
     * @param  {Function} binding - the binding to run
     * @param  {Object} state     - the state bind with
     * @return {Object} state
     */
    bindStep(binding, state) {

        state.binding = binding;

        uav.state = state;

        binding(state);

        uav.state = null;

        return state;

    },

    /**
     * Run the given steps, which are a series of instructions
     * that will construct a DOM tree using the given model.
     * 
     * @param  {Array} steps - the list of instructions
     * @param  {Object} vm   - the view model
     * @param  {Object} ctx  - item and index values if this is a loop (optional)
     * @return {Element}     - the rendered node
     */
    render(steps, vm, ctx) {

        return [{
            vm,
            ctx,
            el: steps.root()
        }].concat(steps).reduce((a, b) => b(a)).el;

    },

    /**
     * Create a DOM element with the given tag name.
     * @param  {String} tag - the tag name
     * @return {Element}
     */
    createElement(tag) {

        if (tag === 'svg' || tag === 'path') {

            return document.createElementNS('http://www.w3.org/2000/svg', tag);

        }

        return document.createElement(tag);

    }

};

export default util;
