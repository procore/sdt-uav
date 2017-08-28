(() => {
    
    /**
     * currentBinding tracks the binding which is currently executing.
     *
     * @type {Function}
     */
    let currentBinding;

    /**
     * currentNode tracks the DOM node which is currently being parsed.
     *
     * @type {Element}
     */
    let currentNode;

    /**
     * attributes is a list of functions for handling element attributes.
     * It can be extended with uav.attributes.push(<Function>) to support
     * new attribute bindings (this is how uav.2way.js works).
     *
     * Attribute functions are passed the following parameters:
     * - node: the element on which the attribute appears
     * - attribute: an object with name and value properties
     * - vm: the view model against which attribute expressions should be evaluated
     * - globals: the parent view model, if node is within a template loop
     * 
     * @type {Array}
     */
    const attributes = [];

    /**
     * ARRAY_METHODS is a list of array methods that alter arrays in place.
     * These methods are wrapped to trigger bindings.
     * 
     * @type {Array}
     */
    const ARRAY_METHODS = ['push', 'pop', 'reverse', 'shift', 'sort', 'splice', 'unshift'];

    /**
     * INVALID_EXPRESSION is used to flag template expressions
     * that throw exceptions.
     * 
     * @type {String}
     */
    const INVALID_EXPRESSION = '_u_badexp';

    /**
     * createElement wraps document.createElement. 
     * This is just to remove a few bytes in minified scripts.
     * 
     * @param  {String} tag - The type of element to create
     * @return {Element}
     */
    const createElement = tag => document.createElement(tag);

    /**
     * defineProp adds a non-enumerable property to an object.
     * 
     * @param  {Object} vm - the object on which to define the property
     * @param  {String} prop - the property name
     * @param  {any} value - the property value
     * @return {Object}
     */
    const defineProp = (vm, prop, value) => Object.defineProperty(vm, prop, {
        value,
        configurable: true,
        writable: true,
        enumerable: false
    });

    /**
     * bindArrayMethod wraps the given method of the given array
     * so that it will trigger bindings.
     * 
     * @param  {String} method - the name of the method to wrap
     * @param  {Array} vm - the array on which to operate
     * @param  {Function} set - the vm's setter descriptor
     * @return {undefined}
     */
    function bindArrayMethod(method, vm, set) {

        defineProp(vm, method, (...args) => {

            Array.prototype[method].apply(vm, args);

            set([...vm]);

        });

    }

    /**
     * bindArrayMethods wraps a predefined list of array methods
     * (ARRAY_METHODS) so that they will trigger bindings when called.
     * 
     * @param  {Array} vm - the array on which to operate
     * @param  {Function} set - the vm's setter descriptor
     * @return {undefined}
     */
    function bindArrayMethods(vm, set) {

        ARRAY_METHODS.forEach(method => bindArrayMethod(method, vm, set));

    }

    /**
     * uav is a global utility for selecting DOM nodes using a CSS selector.
     * - act on the first matched element:  uav('#item').classList.add('active');
     * - act on all matched elements:       uav('.items', el => el.classList.add('active'));
     * - act on the nth matched element:    uav('.items', 2).classList.add('active'));
     * 
     * @param  {String} selector - the CSS selector to search for
     * @param  {(Function|Number)} fnOrIndex (optional)
     *          - a callback, passed all matched nodes, OR
     *          - the index of the matched node to return.
     * @return {(Array|Element)}
     */
    const uav = window.uav = (selector, fnOrIndex) => {

        if (fnOrIndex !== undefined) {

            const els = Array.from(document.querySelectorAll(selector));

            if (typeof fnOrIndex === 'function') {

                els.forEach(fnOrIndex);

            } else if (typeof fnOrIndex === 'number') {

                return els[fnOrIndex];

            }

        } else {

            return document.querySelector(selector) || createElement('div');

        }

    };

    /**
     * setTag sets uav's template syntax. Because the tags
     * are embedded in a regular expression, it may be
     * necessary to escape special characters.
     * 
     * @param {String} open - the opening tag
     * @param {String} close - the closing tag
     */
    function setTag(open, close) {

        uav.tagRX = new RegExp(`(^${open}|${close}$)`, 'g');

        uav.expRX =  new RegExp(`(${open}.*?${close})`, 'g');

    }

    /**
     * Set the default template tags.
     */
    setTag('{', '}');

    /**
     * parse converts an HTML string into a DOM node. The HTML must
     * contain one root node. A parent node may be supplied to
     * support parsing elements like <tr> and <option>, which
     * can only be children of specific HTML elements.
     * 
     * @param  {String} markup - the HTML string to parse
     * @param  {Element} parent - the node into which this HTML will be inserted (optional)
     * @return {Element}
     */
    function parse(markup, parent) {

        const el = parent ? parent.cloneNode() : createElement('div');

        el.innerHTML = markup;

        if (el.children.length > 1) {

            console.error('Only 1 root node allowed.');

        }

        return el.firstElementChild;

    }

    /**
     * Evaluates a template expression with the supplied context(s).
     * Unlike eval(), this does not provide access to execution context
     * from within template expressions. 
     * 
     * @param  {String} expression - the expression to evaluate
     * @param  {any} vm - the scope in which to evaluate, and the value of this
     * @param  {Globals} - the scope in which to evaluate if vm is not an object (optional)
     * @return {any}
     */
    function evaluate(expression, vm, globals) {

        try {

            return new Function(`with(arguments[0]){return ${expression}}`).bind(vm)(globals || vm);

        } catch (err) {

            return INVALID_EXPRESSION;

        }

    }

    /**
     * Recursively removes all bindings associated with
     * the provided DOM node.
     * 
     * @param  {Element} node - the node to unbind
     * @return {undefined}
     */
    function unbind(node) {

        if (node && node._uav) {

            [...node.children].forEach(unbind);

            node._uav.forEach(fn => fn());

            node = null;

        }

    }

    /**
     * Remove template tags from the given expression, if any.
     * 
     * @param  {String} str - the string to remove tags from
     * @return {String}
     */
    const stripTags = str => str.replace(uav.tagRX, '');

    /**
     * Checks to see if a template contains expressions. If so, binds them
     * to a view model so that any changes to the relevant properties will
     * trigger the binding.
     * 
     * @param  {Object} opts - binding options, as follows:
     *          {
     *              tmpl   : {string} the template string to check
     *              single : {boolean} this template is guaranteed to have one expression
     *              replace: {function} handles in-progress template evaluations
     *              commit : {function} handles completed template evaluations
     *          }
     *
     * @param  {Object} vm - the view model for the expression
     * @param  {Object} globals - the parent view model (optional)
     * @return {undefined}
     */
    function bind(opts, vm, globals) {

        const expressions = opts.single ? [opts.tmpl] : opts.tmpl.match(uav.expRX);

        if (expressions) {

            function binding(doBind) {

                expressions.forEach(expression => {

                    const code = stripTags(expression);

                    if (doBind) {

                        currentBinding = binding;

                    }

                    let value = evaluate(code, vm, globals);

                    currentBinding = null;

                    if (typeof value === 'boolean') {

                        value = value ? code : '';

                    } else if (value === undefined || value === null || value === INVALID_EXPRESSION) {

                        value = '';

                    }

                    opts.replace(value, expression);

                });

                if (opts.commit) {

                    opts.commit();

                }

            }

            binding(true);

        }

    }

    /**
     * Run the given callback with each attribute on the given node.
     * 
     * @param  {Element} el - the node to check
     * @param  {Function} callback - passed each attribute
     * @return {undefined}
     */
    function forEachAttribute(el, callback) {

        const attrs = Array.from(el.attributes)
            .filter(attribute => attribute.specified)
            .map(attribute => {

                return {
                    name: attribute.name,
                    value: attribute.value
                };

            });

        attrs.forEach(attribute => callback(attribute));

        if (el.value) {

            callback({
                name: 'value',
                value: el.value
            });

        }

    }

    /**
     * Template loops:
     *
     * Adds an attribute binding that checks for the attribute
     * "uav-loop". If found, it repeats the given node's 
     * inner HTML for each item in the array denoted by the
     * attribute's value. Creates individual bindings for
     * each index of the array so that the whole loop doesn't
     * have to be re-rendered when one item changes.
     */
    attributes.push((node, attribute, vm) => {

        if (attribute.name === 'uav-loop') {

            const loopNode = parse(node.innerHTML, node);

            return {
                loop: true,
                tmpl: attribute.value,
                single: true,
                replace: list => {

                    list = model(list);

                    [...node.children].forEach(unbind);

                    node.innerHTML = '';

                    list.forEach((item, i) => {

                        function listBinding(doBind) {

                            const child = loopNode.cloneNode();

                            child.innerHTML = loopNode.innerHTML;

                            if (doBind) {

                                currentBinding = listBinding;

                            }

                            const index = vm._index;

                            defineProp(vm, '_index', i);

                            if (node.children[i]) {

                                node.replaceChild(render(child, list[i], vm), node.children[i]);

                            } else {

                                node.appendChild(render(child, list[i], vm));

                            }

                            vm._index = index;

                            currentBinding = null;

                        }

                        listBinding(true);

                    });

                }
            };

        }

    });

    /**
     * Style attributes:
     *
     * Some IE versions only allow valid CSS in style attributes,
     * meaning that template expressions need to be transferred from a
     * "uav-stye" attribute to the "style" attribute after binding.
     */
    attributes.push((node, attribute) => {

        if (attribute.name === 'style' || attribute.name === 'uav-style') {

            const tmpl = attribute.value;

            let style = tmpl;

            return {
                tmpl,
                replace: (value, expression) => {

                    style = style.replace(expression, value);

                },
                commit: () => {

                    node.style.cssText = style;

                    style = tmpl;

                }
            };

        }

    });

    /**
     * Source attributes:
     * 
     * A template expression like the following would result in a 404:
     * <img src="https://example.com/{pageId}"/>
     *
     * To avoid setting the src attribute until the expression is 
     * evaluated, use the "uav-src" attribute instead.
     */
    attributes.push((node, attribute) => {

        if (attribute.name === 'uav-src') {

            const tmpl = attribute.value;

            let source = tmpl;

            return {
                tmpl,
                replace: (value, expression) => {

                    source = source.replace(expression, value);

                },
                commit: () => {

                    node.setAttribute('src', source);

                    source = tmpl;

                }
            };

        }

    });

    /**
     * Boolean attributes:
     *
     * This binding handles valueless attributes like <input {disabled}/>.
     * While it makes most sense to bind these to boolean values,
     * it supports binding them to strings as well.
     */
    attributes.push((node, attribute) => {

        if (attribute.name.match(uav.expRX)) {

            let property;

            return {
                tmpl: attribute.name,
                replace: value => {

                    if (property) {

                        node.removeAttribute(property);

                    }

                    if (value) {

                        node.setAttribute(value, '');

                        property = value;

                    }

                }
            };

        }

    });

    /**
     * All other attributes:
     *
     * Any other attributes containing template expressions
     * are handled here. Expressions which evaluate to functions
     * are treated as event handlers.
     */
    function defaultAttributeCheck(node, attribute) {

        const tmpl = attribute.value;

        let result = tmpl;

        return {
            tmpl,
            replace: (value, expression) => {

                if (typeof value === 'function') {

                    result = value;

                } else {

                    result = result.replace(expression, value);

                }

            },
            commit: () => {

                if (typeof result === 'function') {

                    node.removeAttribute(attribute.name);

                    node[attribute.name] = result;

                } else {

                    node.setAttribute(attribute.name, result);

                }

                result = tmpl;

            }
        };

    }

    /**
     * bindAttribute runs an attribute through all of the
     * defined attribute binding functions.
     * 
     * @param  {Element} node - the owner of the attribute 
     * @param  {Object} attribute - an object with name and value properties
     * @param  {Object} vm - the current view model
     * @param  {Object} globals - the parent view model (optional)
     * @return {Boolean} isLoop - indicates whether the node contains a template loop
     */
    function bindAttribute(node, attribute, vm, globals) {

        let isLoop;

        for (let i = 0; i < attributes.length; i++) {

            const opts = attributes[i](node, attribute, vm, globals);

            if (opts) {

                node.removeAttribute(attribute.name);

                bind(opts, vm, globals);

                if (opts.loop) {

                    isLoop = true;

                }

            }

        }

        bind(defaultAttributeCheck(node, attribute), vm, globals);

        return isLoop;

    }

    /**
     * bindTextNode creates a binding for the given text node.
     * 
     * @param  {Element} node - the text node to parse
     * @param  {Object} vm - the current view model
     * @param  {Object} globals - the parent view model (optional)
     * @return {undefined}
     */
    function bindTextNode(node, vm, globals) {

        bind({
            tmpl: node.textContent,
            replace: value => {

                if (value.tagName || value._el) {

                    const newNode = value._el ? value._el : value;

                    if (newNode !== node) {

                        unbind(node);

                    }

                    if (node.parentNode) {

                        node.parentNode.replaceChild(newNode, node);

                        node = newNode;

                    }

                } else {

                    try {

                        node.textContent = value;

                    } catch (e) {

                        node.innerHTML = '';
                    }

                }

            }
        }, vm, globals);

    }

    /**
     * If a text node contains template expressions,
     * explodeTextNode creates an individual text node
     * for each expression (for effecient updates later).
     * 
     * @param  {Element} node - the starting text node
     * @param  {Object} vm - the current view model
     * @param  {Object} globals - the parent view model (optional)
     * @return {undefined}
     */
    function explodeTextNode(node, vm, globals) {

        const parts = node.textContent.split(uav.expRX);

        const parent = node.parentNode;

        let lastNode = node;

        parts.forEach(part => {

            if (part) {

                const newNode = document.createTextNode(part);

                parent.insertBefore(newNode, lastNode.nextSibling);

                bindTextNode(newNode, vm, globals);

                lastNode = newNode;

            }

        });

        parent.removeChild(node);

    }

    /**
     * Recursively checks an element's attributes and children
     * for template expressions.
     * 
     * @param  {Element} node - the node to parse
     * @param  {Object} vm - the current view model
     * @param  {Object} globals - the parent view model (optional)
     * @return {Element}
     */
    function render(node, vm, globals) {

        let isLoop;

        currentNode = node;

        defineProp(currentNode, '_uav', []);

        forEachAttribute(node, attribute => {

            if (bindAttribute(node, attribute, vm, globals)) {

                isLoop = true;

            }

        });

        if (isLoop) {

            return node;

        }

        Array.from(node.childNodes).forEach(child => {

            if (child.nodeType === 3) {

                explodeTextNode(child, vm, globals); 
            
            } else {

                render(child, vm, globals);

            }

        });

        return node;

    }

    /**
     * Determines whether an object is eligible for use as a view model.
     * 
     * @param  {any} data
     * @return {Boolean}
     */
    function isVmEligible(data) {

        return !(!data || typeof data !== 'object' || data._uav || data.tagName);

    }

    /**
     * For use as a placeholder for a child component.
     * 
     * @param  {String} tag - the type of element to create (optional)
     * @return {Object}
     */
    function placeholder(tag) {

        return {
            _el: createElement(tag || 'div')
        };

    }

    /**
     * When a view model is replaced, we need to recursively
     * copy all of its bindings to the new model.
     * 
     * @param  {Object} from - the old view model
     * @param  {Object} to - the new view model
     * @return {undefined}
     */
    function copyBindings(from, to) {

        if (from._uav && to) {

            Object.keys(from).forEach(key => {

                copyBindings(from[key], to[key]);

            });

            to._uav = from._uav;

            from = null;

        }

    }

    /**
     * If the given object is eligible to be a view model,
     * add getters and setters to its properties.
     * 
     * @param  {any} data - the source for the model
     * @return {any}
     */
    function model(data) {

        if (!isVmEligible(data)) {

            return data;

        }

        const vm = Array.isArray(data) ? [] : {};

        /**
         * The hidden _uav property contains all
         * of the view model's bindings.
         */
        defineProp(vm, '_uav', {});

        Object.keys(data).forEach(key => {

            /**
             * The processValue helper adds getters
             * and setters for all children of the vm.
             */
            function processValue(value) {

                if (isVmEligible(value)) {

                    value = model(value);

                    if (Array.isArray(value)) {

                        bindArrayMethods(value, set);

                    }

                }

                return value;

            }

            /**
             * If a property is accessed during evaluation of
             * a template expression, then it should be bound.
             */
            function get() {

                if (currentBinding) {

                    /**
                     * Associate the binding with this property.
                     */
                    let binding = currentBinding;

                    vm._uav[key] = vm._uav[key] || [];

                    vm._uav[key].push(binding);

                    /**
                     * Store a closure that will remove this binding
                     * If the node is removed or replaced later.
                     */
                    currentNode._uav.push(() => {

                        const index = vm._uav[key].indexOf(binding);

                        vm._uav[key].splice(index, 1);

                        binding = null;

                    });

                }

                /**
                 * Keeping track of the last accessed property
                 * is necessary for two-way binding.
                 */
                uav.lastAccessed = {vm, key};

                return data[key];

            }

            /**
             * Handle changes to a property on the model.
             */
            function set(value) {

                if (data[key] !== value || typeof value === 'object') {

                    /**
                     * If the new value is eligible for use as a vm,
                     * recursively add getters and setters.
                     */
                    if (isVmEligible(value)) {

                        value = processValue(value);

                        /**
                         * Copy over any bindings from the previous value
                         */
                        if (data[key] && data[key]._uav) {

                            copyBindings(data[key], value);

                        }

                    }

                    /**
                     * Store the new value.
                     */
                    data[key] = value;

                    /**
                     * Run any bindings to this property.
                     */
                    if (vm._uav[key]) {

                        vm._uav[key].forEach(fn => fn());

                    }

                }

            }

            data[key] = processValue(data[key] ? data[key].valueOf() : data[key]);

            Object.defineProperty(vm, key, {
                get,
                set,
                enumerable: true,
                configurable: true
            });

        });

        return vm;

    }

    /**
     * Creates a component for the given model and template.
     * Renders the component into the specified element, if any.
     * 
     * @param  {Object} vm - the data for the component's view model (optional)
     * @param  {String} tmpl - the component's HTML template
     * @param  {String} selector - the CSS selector for the node in 
     *          which to render the component (optional)
     * @return {Object} vm
     */
    function component(vm, tmpl, selector) {

        if (typeof vm === 'string') {

            vm = {_el: parse(vm)};

            selector = tmpl;

        } else {

            vm = model(vm);

            vm._el = render(parse(tmpl), vm);

        }

        if (typeof selector === 'string' || selector.tagName) {

            const app = selector.tagName ? selector : uav(selector);

            const oldComponent = app.firstElementChild;

            requestAnimationFrame(() => unbind(oldComponent));

            app.innerHTML = '';

            app.appendChild(vm._el);

        }

        for (let i = 0; i < arguments.length; i++) {
            
            if (typeof arguments[i] === 'function') {

                requestAnimationFrame(() => arguments[i](vm._el));

                break;

            }

        }

        return vm;

    }

    /**
     * Methods intended primarily for internal use
     */
    uav.attributes  = attributes;
    uav.evaluate    = evaluate;
    uav.stripTags   = stripTags;

    /**
     * Methods intended for public use
     */
    uav.component   = component;
    uav.model       = model;
    uav.parse       = parse;
    uav.placeholder = placeholder;
    uav.setTag      = setTag;
    uav.unbind      = unbind;

    if (typeof module !== 'undefined' && module.exports) {

        module.exports = uav;

    }

})();
