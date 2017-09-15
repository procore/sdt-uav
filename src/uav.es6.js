(() => {

    /*
     * Array.prototype.from shim for IE
     *
     * Spread operators would be preferable syntactically, but the Babel 
     * shim for that is nearly 100 bytes gzipped.
     */
    if (!Array.from) {

        Array.from = function(object) {

            return [].slice.call(object);

        };

    }
    
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
     * attributes is a list of functions for parsing element attributes.
     * It can be extended with uav.attributes.push(<Function>) to support
     * new attribute binding types (this is how uav-bind works).
     *
     * Attribute parsers are passed the following parameters:
     * - node: the element on which the attribute appears
     * - attribute: an object with name and value properties
     * - vm: the view model against which attribute expressions should be evaluated
     * 
     * @type {Array}
     */
    const attributes = [];

    /**
     * INVALID_EXPRESSION is used to flag template expressions
     * that throw exceptions.
     * 
     * @type {String}
     */
    const INVALID_EXPRESSION = '_u_badexp';

    /**
     * createElement wraps document.createElement. 
     * This is just to remove a few bytes in the mangled output.
     * 
     * @param  {String} tag - The type of element to create
     * @return {Element}
     */
    const createElement = tag => document.createElement(tag);

    /**
     * Wrapping typeof saves a handful of bits too.
     *
     * @param {any} val - a value
     * @param {String} type - a primitive type
     * @return {Boolean}
     */
    const _typeof = (val, type) => typeof val === type;

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
     * bindArrayMethods wraps array methods so that they 
     * will do three things when called:
     * 1) Call the native method on the array
     * 2) Update any loops associated with the array, 
     *    by rearranging, removing, and/or inserting nodes
     *    as required by the particular method.
     * 3) Trigger any non-loop bindings to the array.
     * 
     * @param  {Array} list - the array on which to operate
     * @param  {Function} set - the list's setter descriptor
     * @return {undefined}
     */
    function bindArrayMethods(list, set) {
        
        defineProp(list, 'push', (...args) => {

            args = args.map(model);

            Array.prototype.push.apply(list, args);

            list._loops.forEach(loop => {

                for (let i = list.length - args.length; i < list.length; i++) {

                    list._watch(i, list[i]);

                    loop.bind(list, i, true);

                }

            });

            set(list, true);

            return list;

        });

        defineProp(list, 'pop', () => {

            list._loops.forEach(loop => loop.remove(list.length - 1));

            const result = Array.prototype.pop.call(list);

            set(list, true);

            return result;

        });

        defineProp(list, 'reverse', () => {

            list._loops.forEach(loop => {

                const children = Array.from(loop.node.children);

                for (let i = list.length - 1; i >= 0; i--) {

                    loop.node.appendChild(children[i]);

                }

            });

            Array.prototype.reverse.call(list);

            set(list, true);

            return list;

        });

        defineProp(list, 'shift', () => {

            list._loops.forEach(loop => loop.remove(0));

            const result = Array.prototype.shift.call(list);

            set(list, true);

            return result;

        });

        defineProp(list, 'sort', sort => {

            const temp = Array.from(list);

            Array.prototype.sort.call(list, sort);

            list._loops.forEach(loop => {

                const nodes = [];

                list.forEach(value => nodes.push(loop.node.children[temp.indexOf(value)]));

                nodes.forEach((child, j) => loop.node.insertBefore(child, loop.node.children[j]));

            });

            set(list, true);

            return list;

        });

        defineProp(list, 'splice', (...args) => {

            args = args.map(model);

            const start = args.shift();

            const deleteCount = args.shift();

            const result = Array.prototype.splice.apply(list, [start, deleteCount].concat(args));

            if (list._loops) {

                for (let i = 0; i < deleteCount; i++) {

                    list._loops.forEach(loop => loop.remove(start));

                }

                list._loops.forEach(loop => {

                    args.forEach((arg, i) => {

                        list._watch(i, list[start + i]);

                        loop.bind(list, start + i, true);

                    });

                });

            }

            set(list, true);

            return result;

        });

        defineProp(list, 'unshift', (...args) => {

            args = args.map(model);

            Array.prototype.unshift.apply(list, args);

            list._loops.forEach(loop => {

                args.forEach((arg, i) => {

                    list._watch(i, list[i]);

                    loop.bind(list, i, true);

                });

            });

            set(list, true);

            return list;

        });

    }

    /**
     * Selects an array of DOM nodes using a CSS selector.
     * - act on all matched elements:       uav.all('.items', el => el.classList.add('active'));
     * - act on the nth matched element:    uav.all('.items')[2].classList.add('active'));
     * - return all matched elements:       uav.all('.items').forEach(el => el.classList.add('active'));
     * 
     * @param  {String} selector - the CSS selector to search for
     * @param  {(Function)} callback (optional) a callback, passed all matched nodes.
     * @return {Array}
     */
    function all(selector, callback) {

        const els = Array.from(document.querySelectorAll(selector));

        if (callback) {

            return els.forEach(callback);

        }

        return els;

    }

    /**
     * uav is a global utility for selecting DOM nodes using a CSS selector.
     * - act on the first matched element:  uav('#item').classList.add('active');
     * - act on all matched elements:       uav('.items', el => el.classList.add('active'));
     * 
     * @param  {String} selector - the CSS selector to search for
     * @param  {(Function)} callback (optional) a callback, passed all matched nodes.
     * @return {(Array|Element)}
     */
    const uav = window.uav = (selector, callback) => {

        if (callback) {

            return all(selector, callback);

        }

        return document.querySelector(selector) || createElement('div');

    };

    /**
     * setTag sets uav's template syntax. Because the tags
     * are embedded in a regular expression, it may be
     * necessary to escape special characters.
     * 
     * @param {String} open - the opening tag
     * @param {String} close - the closing tag
     * @return {undefined}
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
     * @return {any}
     */
    function evaluate(expression, vm) {

        try {

            return new Function(`with(arguments[0]){return ${expression}}`).call(vm, vm);

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

            Array.from(node.children).forEach(unbind);

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
     * Checks to see if a template contains expressions. If so, binds the
     * relevant properties of the view model to the DOM node being parsed.
     * 
     * @param  {Object} opts - binding options, as follows:
     *          {
     *              tmpl    : {string} the template string to check
     *              one     : {boolean} this template is guaranteed to have one expression
     *              replace : {function} handles incremental evaluations of templates with multiple expressions
     *              commit  : {function} handles completed template evaluations
     *          }
     *
     * @param  {Object} vm - the view model for the expression
     * @param  {Object} loopMethods - set and reset methods for rendering loops. Optional.
     * @return {undefined}
     */
    function bind(opts, vm, loopMethods) {

        const expressions = opts.one ? [opts.tmpl] : opts.tmpl.match(uav.expRX);

        if (expressions) {

            /**
             * binding is the function that runs when a bound model property is changed.
             * 
             * @param  {Boolean} doBind - whether a new binding should be created (only the first run)
             * @param  {Boolean} preventLoopRender - a flag passed from bindArrayMethods, indicating
             *                                       that any rendering required by this change has
             *                                       been completed by the array method override.
             * @return {undefined}
             */
            function binding(doBind, preventLoopRender) {

                expressions.forEach(expression => {

                    const code = stripTags(expression);

                    if (loopMethods) {

                        loopMethods.set(vm);

                    }

                    if (doBind) {

                        currentBinding = binding;

                    }

                    let value = evaluate(code, vm);

                    currentBinding = null;

                    if (loopMethods) {

                        loopMethods.reset(vm);

                    }

                    if (_typeof(value, 'boolean')) {

                        value = value ? code : '';

                    } else if (value === undefined || value === null || value === INVALID_EXPRESSION) {

                        value = '';

                    }

                    opts.replace(value, expression, preventLoopRender);

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

            const loopVars = node.getAttribute('uav-as').split(',');

            node.removeAttribute('uav-as');

            const loop = {
                node,
                as: loopVars[0],
                index: loopVars[1],
                html: node.innerHTML,
                remove: i => {

                    if (node.children[i]) {

                        unbind(node.children[i]);

                        node.children[i].remove();

                    }

                },
                bind: (list, i, insert) => {

                    function binding(doBind) {

                        const childAtIndex = loop.node.children[i];

                        const child = parse(loop.html, loop.node);

                        const origAs = vm[loop.as];

                        const origIndex = vm[loop.index];

                        const loopMethods = {

                            set(_vm) {

                                _vm[loop.as] = list[i];

                                if (loop.index) {
                                
                                    _vm[loop.index] = i;

                                }

                            },

                            reset(_vm) {

                                _vm[loop.as] = origAs;

                                if (loop.index) {

                                    _vm[loop.index] = origIndex;

                                }

                            }

                        };

                        if (doBind) {

                            currentBinding = binding;

                        }

                        /**
                         * Insert and bind a new node at the current index
                         */
                        if (insert && doBind && childAtIndex) {

                            loop.node.insertBefore(render(child, vm, loopMethods), childAtIndex);

                        /**
                         * Replace and bind the node at the current index
                         */
                        } else if (childAtIndex) {

                            loop.node.replaceChild(render(child, vm, loopMethods), childAtIndex);

                        /**
                         * Append and bind a new node
                         */
                        } else {

                            loop.node.appendChild(render(child, vm, loopMethods));

                        }

                        currentBinding = null;

                    }

                    binding(true);

                }

            };

            return {
                loop: true,
                tmpl: attribute.value,
                one: true,
                replace: (list, expression, preventLoopRender) => {

                    if (preventLoopRender) {

                        return;

                    }

                    node.innerHTML = '';

                    list = model(list);

                    if (list._loops.indexOf(loop) === -1) {

                        list._loops.push(loop);

                    }

                    list.forEach((item, i) => loop.bind(list, i));

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

        if (attribute.name === 'uav-attr') {

            let property;

            return {
                tmpl: attribute.value,
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

                if (_typeof(value, 'function')) {

                    result = value;

                } else {

                    result = result.replace(expression, value);

                }

            },
            commit: () => {

                if (_typeof(result, 'function')) {

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
     * @param  {Object} loopMethods - set and reset methods for rendering loops. Optional.
     * @return {Boolean} isLoop - indicates whether the node contains a template loop
     */
    function bindAttribute(node, attribute, vm, loopMethods) {

        let isLoop;

        for (let i = 0; i < attributes.length; i++) {

            const opts = attributes[i](node, attribute, vm);

            if (opts) {

                node.removeAttribute(attribute.name);

                bind(opts, vm, loopMethods);

                if (opts.loop) {

                    isLoop = true;

                }

            }

        }

        bind(defaultAttributeCheck(node, attribute), vm, loopMethods);

        return isLoop;

    }

    /**
     * bindTextNode creates a binding for the given text node.
     * 
     * @param  {Element} node - the text node to parse
     * @param  {Object} vm - the current view model
     * @param  {Object} loopMethods - set and reset methods for rendering loops. Optional.
     * @return {undefined}
     */
    function bindTextNode(node, vm, loopMethods) {

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
        }, vm, loopMethods);

    }

    /**
     * If a text node contains template expressions,
     * explodeTextNode creates an individual text node
     * for each expression (for effecient updates later).
     * 
     * @param  {Element} node - the starting text node
     * @param  {Object} vm - the current view model
     * @param  {Object} loopMethods - set and reset methods for rendering loops. Optional.
     * @return {undefined}
     */
    function explodeTextNode(node, vm, loopMethods) {

        const parts = node.textContent.split(uav.expRX);

        if (parts.length > 1) {

            const parent = node.parentNode;

            parts.forEach(part => {

                if (part.trim()) {

                    const newNode = document.createTextNode(part);

                    parent.insertBefore(newNode, node);

                    bindTextNode(newNode, vm, loopMethods);

                }

            });

            parent.removeChild(node);

        }

    }

    /**
     * Recursively checks an element's attributes and children
     * for template expressions.
     * 
     * @param  {Element} node - the node to parse
     * @param  {Object} vm - the current view model
     * @param  {Object} loopMethods - set and reset methods for rendering loops. Optional.
     * @return {Element}
     */
    function render(node, vm, loopMethods) {

        let isLoop;

        currentNode = node;

        /**
         * node._uav is where we'll store garbage collection functions
         * to run if the node is removed or replaced later.
         */
        defineProp(currentNode, '_uav', []);

        forEachAttribute(node, attribute => {

            if (bindAttribute(node, attribute, vm, loopMethods)) {

                isLoop = true;

            }

        });

        if (isLoop) {

            return node;

        }

        Array.from(node.childNodes).forEach(child => {

            if (child.nodeType === 3) {

                explodeTextNode(child, vm, loopMethods); 
            
            } else {

                render(child, vm, loopMethods);

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

        return !(!data || !_typeof(data, 'object') || data._uav || data.tagName);

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

        if (from && from._uav && to) {

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

        let vm = {};

        if (Array.isArray(data)) {

            vm = [];

            /**
             * Array._loops is where we'll store information
             * about the template loops bound to this array.
             */
            defineProp(vm, '_loops', []);

        }

        /**
         * The hidden _uav property contains all
         * of the view model's bindings.
         */
        defineProp(vm, '_uav', {});

        defineProp(vm, '_watch', (key, val) => {

            /**
             * The processValue helper adds getters
             * and setters for all children of the vm.
             */
            function processValue(value) {

                if (isVmEligible(value)) {

                    value = model(value);

                }

                if (Array.isArray(value)) {

                    bindArrayMethods(value, set);

                }

                return value;

            }

            /**
             * If a property is accessed during evaluation of
             * a template expression, then it should be bound.
             */
            function get() {

                /**
                 * If there is currently a binding being created at the
                 * time that this model property is accessed, it means
                 * that this property is referenced within the template
                 * expression, and therefore should be bound.
                 */
                if (currentBinding) {

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
             *
             * @param {any} value - the property's new value
             * @param {Boolean} preventLoopRender - a flag passed by bindArrayMethods,
             *                                      indicating that any DOM updates
             *                                      are already complete.
             */
            function set(value, preventLoopRender) {

                if (data[key] !== value || _typeof(value, 'object')) {

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

                        vm._uav[key].forEach(fn => fn(false, preventLoopRender));

                    }

                }

            }

            data[key] = processValue(val);

            Object.defineProperty(vm, key, {
                get,
                set,
                enumerable: true,
                configurable: true
            });

        });        

        Object.keys(data).forEach(key => vm._watch(key, data[key]));

        return vm;

    }

    /**
     * Creates a component for the given model and template.
     * Renders the component into the specified element, if any.
     * 
     * @param {Object} vm - the data for the component's view model (optional)
     * @param {String} tmpl - the component's HTML template
     * @param {String} selector - the CSS selector for the node in 
     *          which to render the component (optional)
     * @param {Function} callback - runs after the render, passed the root node (optional)
     * @return {Object} vm
     */
    function component(vm, tmpl, selector) {

        if (_typeof(vm, 'string')) {

            vm = {_el: parse(vm)};

            selector = tmpl;

        } else {

            vm = model(vm);

            vm._el = render(parse(tmpl), vm);

        }

        if (_typeof(selector, 'string') || selector && selector.tagName) {

            const app = selector.tagName ? selector : uav(selector);

            const oldComponent = app.firstElementChild;

            requestAnimationFrame(() => unbind(oldComponent));

            app.innerHTML = '';

            app.appendChild(vm._el);

        }

        for (let i = 0; i < arguments.length; i++) {
            
            if (_typeof(arguments[i], 'function')) {

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
    uav.all         = all;
    uav.component   = component;
    uav.model       = model;
    uav.parse       = parse;
    uav.setTag      = setTag;
    uav.unbind      = unbind;

    if (typeof module !== 'undefined' && module.exports) {

        module.exports = uav;

    }

})();
