(function () {

    /*
     * Array.prototype.from shim for IE
     *
     * Spread operators would be preferable syntactically, but the Babel 
     * shim for that is nearly 100 bytes gzipped.
     */
    if (!Array.from) {

        Array.from = function (object) {

            return [].slice.call(object);
        };
    }

    /**
     * currentBinding tracks the binding which is currently executing.
     *
     * @type {Function}
     */
    var currentBinding = void 0;

    /**
     * currentNode tracks the DOM node which is currently being parsed.
     *
     * @type {Element}
     */
    var currentNode = void 0;

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
    var attributes = [];

    /**
     * INVALID_EXPRESSION is used to flag template expressions
     * that throw exceptions.
     * 
     * @type {String}
     */
    var INVALID_EXPRESSION = '_u_badexp';

    /**
     * createElement wraps document.createElement. 
     * This is just to remove a few bytes in the mangled output.
     * 
     * @param  {String} tag - The type of element to create
     * @return {Element}
     */
    var createElement = function createElement(tag) {
        return document.createElement(tag);
    };

    /**
     * Wrapping typeof saves a handful of bits too.
     *
     * @param {any} val - a value
     * @param {String} type - a primitive type
     * @return {Boolean}
     */
    var _typeof = function _typeof(val, type) {
        return typeof val === type;
    };

    /**
     * defineProp adds a non-enumerable property to an object.
     * 
     * @param  {Object} vm - the object on which to define the property
     * @param  {String} prop - the property name
     * @param  {any} value - the property value
     * @return {Object}
     */
    var defineProp = function defineProp(vm, prop, value) {
        return Object.defineProperty(vm, prop, {
            value: value,
            configurable: true,
            writable: true,
            enumerable: false
        });
    };

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
    function bindArrayMethods(list) {

        defineProp(list, 'push', function () {
            for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
                args[_key] = arguments[_key];
            }

            var startIndex = list.length;

            args = args.map(model);

            args.forEach(function (arg) {
                return list._watch(arg, list.length);
            });

            list._loops.forEach(function (loop) {

                args.forEach(function (arg, i) {

                    loop.binding(arg, startIndex + i);
                });
            });

            return list;
        });

        defineProp(list, 'pop', function () {

            list._loops.forEach(function (loop) {
                return loop.remove(list.length - 1);
            });

            return Array.prototype.pop.call(list);
        });

        defineProp(list, 'shift', function () {

            list._loops.forEach(function (loop) {
                return loop.remove(0);
            });

            var result = Array.prototype.shift.call(list);

            return result;
        });

        defineProp(list, 'splice', function () {
            for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
                args[_key2] = arguments[_key2];
            }

            var originalLength = list.length;

            var start = args.shift();

            var deleteCount = args.shift();

            args = args.map(model);

            var result = Array.prototype.splice.apply(list, [start, deleteCount].concat(args));

            var _loop = function _loop(i) {

                list._watch(list[i], i);

                list._loops.forEach(function (loop) {
                    return loop.binding(list[i], i);
                });
            };

            for (var i = originalLength; i < list.length; i++) {
                _loop(i);
            }

            var _loop2 = function _loop2(i) {

                list._loops.forEach(function (loop) {
                    return loop.remove(i);
                });
            };

            for (var i = list.length; i < originalLength; i++) {
                _loop2(i);
            }

            return result;
        });

        defineProp(list, 'unshift', function () {
            for (var _len3 = arguments.length, args = Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
                args[_key3] = arguments[_key3];
            }

            var originalLength = list.length;

            args = args.map(model);

            Array.prototype.unshift.apply(list, args);

            var _loop3 = function _loop3(i) {

                list._watch(list[i], i);

                list._loops.forEach(function (loop) {
                    return loop.binding(list[i], i);
                });
            };

            for (var i = originalLength; i < list.length; i++) {
                _loop3(i);
            }

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

        var els = Array.from(document.querySelectorAll(selector));

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
    var uav = window.uav = function (selector, callback) {

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

        uav.tagRX = new RegExp('(^' + open + '|' + close + '$)', 'g');

        uav.expRX = new RegExp('(' + open + '.*?' + close + ')', 'g');
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

        var el = parent ? parent.cloneNode() : createElement('div');

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

            return new Function('with(arguments[0]){return ' + expression + '}')(vm);
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

            node._uav.forEach(function (fn) {
                return fn();
            });

            node = null;
        }
    }

    /**
     * Remove template tags from the given expression, if any.
     * 
     * @param  {String} str - the string to remove tags from
     * @return {String}
     */
    var stripTags = function stripTags(str) {
        return str.replace(uav.tagRX, '');
    };

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
     * @return {undefined}
     */
    function bind(opts, vm, loopMethods) {

        var expressions = opts.one ? [opts.tmpl] : opts.tmpl.match(uav.expRX);

        if (expressions) {

            /**
             * binding is the function that runs when a bound model property is changed.
             * 
             * @param  {Boolean} doBind - whether a new binding should be created (only the first run)
             * @return {undefined}
             */
            var binding = function binding(doBind) {

                expressions.forEach(function (expression) {

                    var code = stripTags(expression);

                    if (doBind) {

                        currentBinding = binding;
                    }

                    if (loopMethods) {

                        loopMethods.set(vm);
                    }

                    var value = evaluate(code, vm);

                    currentBinding = null;

                    if (loopMethods) {

                        loopMethods.reset(vm);
                    }

                    if (_typeof(value, 'boolean')) {

                        value = value ? code : '';
                    } else if (value === undefined || value === null || value === INVALID_EXPRESSION) {

                        value = '';
                    }

                    opts.replace(value, expression);
                });

                if (opts.commit) {

                    opts.commit();
                }
            };

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

        var attrs = Array.from(el.attributes).filter(function (attribute) {
            return attribute.specified;
        }).map(function (attribute) {

            return {
                name: attribute.name,
                value: attribute.value
            };
        });

        attrs.forEach(function (attribute) {
            return callback(attribute);
        });

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
    attributes.push(function (node, attribute, vm) {

        if (attribute.name === 'uav-loop') {

            var loopVars = node.getAttribute('uav-as').split(',');

            node.removeAttribute('uav-as');

            var loop = {
                node: node,
                as: loopVars[0],
                index: loopVars[1],
                html: node.innerHTML,
                remove: function remove(i) {

                    if (node.children[i]) {

                        unbind(node.children[i]);

                        node.children[i].remove();
                    }
                },
                binding: function binding(item, i, insert) {

                    var childAtIndex = loop.node.children[i];

                    var child = parse(loop.html, loop.node);

                    var origAs = vm[loop.as];

                    var origIndex = vm[loop.index];

                    var loopMethods = {
                        set: function set(_vm) {

                            _vm[loop.as] = item;

                            if (loop.index) {

                                _vm[loop.index] = i;
                            }
                        },
                        reset: function reset(_vm) {

                            _vm[loop.as] = origAs;

                            if (loop.index) {

                                _vm[loop.index] = origIndex;
                            }
                        }
                    };

                    /**
                     * Insert and bind a new node at the current index
                     */
                    if (insert && childAtIndex) {

                        loop.node.insertBefore(render(child, vm, loopMethods), childAtIndex);

                        /**
                         * Replace and bind the node at the current index
                         */
                    } else if (childAtIndex) {

                        unbind(childAtIndex);

                        loop.node.replaceChild(render(child, vm, loopMethods), childAtIndex);

                        /**
                         * Append and bind a new node
                         */
                    } else {

                        loop.node.appendChild(render(child, vm, loopMethods));
                    }
                }

            };

            return {
                loop: true,
                tmpl: attribute.value,
                one: true,
                replace: function replace(list) {

                    node.innerHTML = '';

                    list = model(list);

                    if (list._loops.indexOf(loop) === -1) {

                        list._loops.push(loop);
                    }

                    list.forEach(loop.binding);
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
    attributes.push(function (node, attribute) {

        if (attribute.name === 'style' || attribute.name === 'uav-style') {

            var tmpl = attribute.value;

            var style = tmpl;

            return {
                tmpl: tmpl,
                replace: function replace(value, expression) {

                    style = style.replace(expression, value);
                },
                commit: function commit() {

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
    attributes.push(function (node, attribute) {

        if (attribute.name === 'uav-src') {

            var tmpl = attribute.value;

            var source = tmpl;

            return {
                tmpl: tmpl,
                replace: function replace(value, expression) {

                    source = source.replace(expression, value);
                },
                commit: function commit() {

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
    attributes.push(function (node, attribute) {

        if (attribute.name === 'uav-attr') {

            var property = void 0;

            return {
                tmpl: attribute.value,
                replace: function replace(value) {

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

        var tmpl = attribute.value;

        var result = tmpl;

        return {
            tmpl: tmpl,
            replace: function replace(value, expression) {

                if (_typeof(value, 'function')) {

                    result = value;
                } else {

                    result = result.replace(expression, value);
                }
            },
            commit: function commit() {

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
     * @return {Boolean} isLoop - indicates whether the node contains a template loop
     */
    function bindAttribute(node, attribute, vm, loopMethods) {

        var isLoop = void 0;

        for (var i = 0; i < attributes.length; i++) {

            var opts = attributes[i](node, attribute, vm);

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
     * @return {undefined}
     */
    function bindTextNode(node, vm, loopMethods) {

        bind({
            tmpl: node.textContent,
            replace: function replace(value) {

                if (value.tagName || value._el) {

                    var newNode = value._el ? value._el : value;

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
     * @return {undefined}
     */
    function explodeTextNode(node, vm, loopMethods) {

        var parts = node.textContent.split(uav.expRX);

        if (parts.length > 1) {

            var parent = node.parentNode;

            parts.forEach(function (part) {

                if (part.trim()) {

                    var newNode = document.createTextNode(part);

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
     * @return {Element}
     */
    function render(node, vm, loopMethods) {

        var isLoop = void 0;

        currentNode = node;

        /**
         * node._uav is where we'll store garbage collection functions
         * to run if the node is removed or replaced later.
         */
        defineProp(currentNode, '_uav', []);

        forEachAttribute(node, function (attribute) {

            if (bindAttribute(node, attribute, vm, loopMethods)) {

                isLoop = true;
            }
        });

        if (isLoop) {

            return node;
        }

        Array.from(node.childNodes).forEach(function (child) {

            if (child.nodeType === 3) {

                explodeTextNode(child, vm, loopMethods);
            } else {

                render(child, vm, loopMethods, loopMethods);
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

            Object.keys(from).forEach(function (key) {

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

        var vm = {};

        if (Array.isArray(data)) {

            vm = [];

            defineProp(vm, '_loops', []);

            bindArrayMethods(vm);
        }

        /**
         * The hidden _uav property contains all
         * of the view model's bindings.
         */
        defineProp(vm, '_uav', {});

        defineProp(vm, '_watch', function (val, key) {

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

                    var binding = currentBinding;

                    vm._uav[key] = vm._uav[key] || [];

                    vm._uav[key].push(binding);

                    /**
                     * Store a closure that will remove this binding
                     * If the node is removed or replaced later.
                     */
                    currentNode._uav.push(function () {

                        if (vm._uav[key]) {

                            var index = vm._uav[key].indexOf(binding);

                            vm._uav[key].splice(index, 1);
                        }

                        binding = null;
                    });
                }

                /**
                 * Keeping track of the last accessed property
                 * is necessary for two-way binding.
                 */
                uav.lastAccessed = { vm: vm, key: key };

                return data[key];
            }

            /**
             * Handle changes to a property on the model.
             *
             * @param {any} value - the property's new value
             */
            function set(value) {

                if (data[key] !== value || _typeof(value, 'object')) {

                    var alreadyVM = value && value._uav;

                    value = model(value);

                    /**
                     * Copy over any bindings from the previous value
                     */
                    if (!alreadyVM && data[key] && data[key]._uav) {

                        copyBindings(data[key], value);
                    }

                    /**
                     * Store the new value.
                     */
                    data[key] = value;

                    /**
                     * Run any bindings to this property.
                     */
                    if (vm._uav[key]) {

                        vm._uav[key].forEach(function (fn) {
                            return fn();
                        });
                    }

                    if (vm._loops) {

                        vm._loops.forEach(function (loop) {
                            return loop.binding(data[key], key);
                        });
                    }
                }
            }

            data[key] = model(val);

            Object.defineProperty(vm, key, {
                get: get,
                set: set,
                enumerable: true,
                configurable: true
            });
        });

        Object.keys(data).forEach(function (key) {
            return vm._watch(data[key], key);
        });

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
        var _arguments = arguments;


        if (_typeof(vm, 'string')) {

            vm = { _el: parse(vm) };

            selector = tmpl;
        } else {

            vm = model(vm);

            vm._el = render(parse(tmpl), vm);
        }

        if (_typeof(selector, 'string') || selector && selector.tagName) {

            var app = selector.tagName ? selector : uav(selector);

            var oldComponent = app.firstElementChild;

            setTimeout(function () {
                return unbind(oldComponent);
            });

            app.innerHTML = '';

            app.appendChild(vm._el);
        }

        var _loop4 = function _loop4(i) {

            if (_typeof(_arguments[i], 'function')) {

                setTimeout(function () {
                    return _arguments[i](vm._el);
                });

                return 'break';
            }
        };

        for (var i = 0; i < arguments.length; i++) {
            var _ret4 = _loop4(i);

            if (_ret4 === 'break') break;
        }

        return vm;
    }

    /**
     * Methods intended primarily for internal use
     */
    uav.attributes = attributes;
    uav.evaluate = evaluate;
    uav.stripTags = stripTags;

    /**
     * Methods intended for public use
     */
    uav.all = all;
    uav.component = component;
    uav.model = model;
    uav.parse = parse;
    uav.setTag = setTag;
    uav.unbind = unbind;

    if (typeof module !== 'undefined' && module.exports) {

        module.exports = uav;
    }
})();
