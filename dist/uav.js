(function () {
    'use strict';

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

        var els = Array.from(document.querySelectorAll(selector));

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

    var util = {

        /**
         * Add a non-enumerable property to the given object
         * 
         * @param  {Object} obj   - the target
         * @param  {String} prop  - the name of the property
         * @param  {any} value    - the value of the property
         * @return {Object}       - the target
         */
        defineProp: function defineProp(obj, prop, value) {
            return Object.defineProperty(obj, prop, {
                value: value,
                configurable: true,
                writable: true,
                enumerable: false
            });
        },

        /**
         * Remove any bindings associated with
         * the given DOM node and its children.
         * 
         * @param  {Element} node - the node to unbind
         * @return {undefined}
         */
        unbind: function unbind(node) {

            if (node && node._uav) {

                Array.from(node.children).forEach(util.unbind);

                node._uav.forEach(function (fn) {
                    return fn();
                });

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
        setTag: function setTag(open, close) {

            uav.tagRX = new RegExp('(^' + open + '|' + close + '$)', 'g');

            uav.expRX = new RegExp('(' + open + '.*?' + close + ')', 'g');
        },


        /**
         * Remove any template tag characters from a string
         * 
         * @param  {String} str - the string to change
         * @return {String}
         */
        stripTags: function stripTags(str) {
            return str.replace(uav.tagRX, '');
        },

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
        bindStep: function bindStep(binding, state) {

            uav.state = Object.create(state);

            uav.state.binding = binding;

            binding(uav.state);

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
        render: function render(steps, vm, ctx) {

            uav.node = steps.root();

            util.defineProp(uav.node, '_uav', []);

            return [{
                vm: vm,
                ctx: ctx,
                el: uav.node
            }].concat(steps).reduce(function (a, b) {
                return b(a);
            }).el;
        }
    };

    /**
     * Run an array method with the given arguments.
     * 
     * @param  {Array} list    - the array on which to operate
     * @param  {String} method - the name of the method to run
     * @param  {Array} args    - arguments to pass the method
     * @return {any} - the return value of the called method.
     */
    function runMethod(list, method, args) {

        return Array.prototype[method].apply(list, args);
    }

    /**
     * Wrap all array methods that modify the array,
     * so that the appropriate cleanup or binding 
     * is triggered.
     * 
     * @param  {Array} list - the array to modify
     * @param {Function} runBindings - run any bindings to the array that aren't loops
     * @return {undefined}
     */
    var bindArrayMethods = function bindArrayMethods(list, runBindings) {

        util.defineProp(list, 'fill', function (value) {
            var start = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
            var end = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : list.length;


            uav._pause = true;

            while (start < 0) {

                start += list.length;
            }

            while (end < 0) {

                end += list.length;
            }

            runMethod(list, 'fill', [value, start, end]);

            var _loop = function _loop(i) {

                list._watch(value, i);

                list._loops.forEach(function (loop) {
                    return loop.replace(value, i);
                });
            };

            for (var i = 0; i < end; i++) {
                _loop(i);
            }

            runBindings();

            delete uav._pause;

            return list;
        });

        util.defineProp(list, 'push', function () {
            for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
                args[_key] = arguments[_key];
            }

            var startIndex = list.length;

            runMethod(list, 'push', args);

            var _loop2 = function _loop2(i) {

                list._watch(list[i], i);

                list._loops.forEach(function (loop) {
                    return loop.add(list[i], i);
                });
            };

            for (var i = startIndex; i < startIndex + args.length; i++) {
                _loop2(i);
            }

            runBindings();

            return list;
        });

        util.defineProp(list, 'pop', function () {

            var lastIndex = list.length - 1;

            list._loops.forEach(function (loop) {
                return loop.remove(lastIndex);
            });

            var result = runMethod(list, 'pop');

            runBindings();

            return result;
        });

        util.defineProp(list, 'reverse', function () {

            runMethod(list, 'reverse');

            runBindings();

            return list;
        });

        util.defineProp(list, 'shift', function () {

            uav._pause = true;

            var result = runMethod(list, 'shift');

            list._loops.forEach(function (loop) {

                if (loop.hasIndex) {

                    list.forEach(loop.replace);

                    loop.remove(list.length);
                } else {

                    loop.remove(0);
                }
            });

            runBindings();

            delete uav._pause;

            return result;
        });

        util.defineProp(list, 'sort', function (compare) {

            var result = runMethod(list, 'sort', [compare]);

            runBindings();

            return result;
        });

        util.defineProp(list, 'splice', function () {
            for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
                args[_key2] = arguments[_key2];
            }

            uav._pause = true;

            var index = args[0];

            var deleteCount = args[1] || 0;

            var originalLength = list.length;

            var result = runMethod(list, 'splice', args);

            list._loops.forEach(function (loop) {

                if (loop.hasIndex) {

                    list.forEach(loop.replace);

                    for (var i = originalLength; i > list.length; i--) {

                        loop.remove(i - 1);
                    }
                } else {

                    for (var _i = 0; _i < deleteCount; _i++) {

                        loop.remove(index);
                    }

                    for (var _i2 = 2; _i2 < args.length; _i2++) {

                        loop.insert(args[_i2], index + _i2 - 2);
                    }
                }
            });

            list.forEach(list._watch);

            runBindings();

            delete uav._pause;

            return result;
        });

        util.defineProp(list, 'unshift', function () {
            for (var _len3 = arguments.length, args = Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
                args[_key3] = arguments[_key3];
            }

            uav._pause = true;

            runMethod(list, 'unshift', args);

            list._loops.forEach(function (loop) {

                if (loop.hasIndex) {

                    list.forEach(loop.replace);
                } else {

                    args.forEach(function (arg, j) {

                        loop.insert(arg, j);
                    });
                }
            });

            list.forEach(list._watch);

            runBindings();

            delete uav._pause;

            return list;
        });
    };

    /**
     * Test an object for eligibility to be given
     * view model getters and setters
     * 
     * @param  {Object} data - the object to test
     * @return {Boolean}
     */
    function notVmEligible(data) {

        return !data || typeof data !== 'object' || data.tagName || data instanceof RegExp;
    }

    /**
     * Run any bindings for the given model property.
     * 
     * @param  {Object} bindings - a map of keys to arrays of bindings
     * @param  {String} key      - a model property
     * @return {undefined}
     */
    function runBindings(bindings, key) {

        if (bindings[key]) {

            bindings[key].forEach(function (state) {
                return state.binding(state);
            });
        }
    }

    /**
     * Recursively copy all bindings from one model
     * to another.
     * 
     * @param  {Object} from - the old object
     * @param  {Object} to   - the new object
     * @return {Object}      - the new object
     */
    function copyBindings(from, to) {

        if (from && from._uav && !notVmEligible(to)) {

            Object.keys(from).forEach(function (key) {

                copyBindings(from[key], to[key]);
            });

            to._uav = from._uav;

            to._loops = from._loops;

            from = null;
        }
    }

    /**
     * Adds getters and setters to all properties
     * of an object so that view bindings will be
     * executed if the properties are modified.
     * 
     * @param  {Object|Array} data - the source for the model
     * @return {Object}            - the bound model
     */
    function model(data) {

        if (notVmEligible(data) || data._uav) {

            return data;
        }

        var vm = {};

        if (Array.isArray(data)) {

            vm = [];

            /**
             * There can be two types of bindings on arrays:
             * loops, from the u-for attribute, or standard
             * content bindings, like <div>{list.join(', ')}</div>.
             *
             * These need to be managed differently, so we'll 
             * initialize a separate binding list for loops.
             */
            util.defineProp(vm, '_loops', []);

            /**
             * When it comes to standard content bindings on arrays,
             * note that a change to any index on the array must result
             * in re-evaluating each index and re-rendering the content,
             * as if the whole array had been replaced. This is not a 
             * limitation of uav, it's just the reason that using a template
             * loop to print array content is always a better idea.
             *
             * To more efficiently support this use, however, we can store
             * bindings only on the first index, and trigger those bindings 
             * when any array index is changed. This way we don't have to
             * store and manage the bindings for each index individually.
             *
             * We also need to wrap array methods like push and pop so 
             * that they will trigger these bindings.
             */
            bindArrayMethods(vm, function () {
                return runBindings(vm._uav, 0);
            });
        }

        /**
         * vm._uav is where we'll store the bindings for each property
         * of the model. The binding tree takes the following form:
         *
         * vm._uav = {
         *     propA: [stateObj1, stateObj2],
         *     propB: [stateObj3]
         * };
         */
        util.defineProp(vm, '_uav', {});

        /**
         * Next we add getters and setters for each property
         * on the model. This process is wrapped in a closure,
         * vm._watch, so that new properties can be added and
         * given getters and setters later on.
         */
        util.defineProp(vm, '_watch', function (val, key) {

            function get() {

                /**
                 * When uav.state is defined, this indicates that a
                 * model is being evaluated, and we should associate
                 * the current state with the property being accessed.
                 *
                 * In the case that the view model is an array, we only
                 * want to store bindings if we're accessing the first 
                 * index.
                 */
                if (uav.state && (!vm._loops || key === '0')) {

                    var state = uav.state;

                    vm._uav[key] = vm._uav[key] || [];

                    vm._uav[key].push(state);

                    /**
                     * Save a closure that will remove this binding,
                     * to be run if the node is removed or replaced.
                     */
                    uav.node._uav.push(function () {

                        if (vm._uav[key]) {

                            vm._uav[key].splice(vm._uav[key].indexOf(state), 1);
                        }

                        state = null;
                    });
                }

                /**
                 * Saving a reference to the last accessed model
                 * and property name is necessary for two-way binding.
                 */
                uav.last = { vm: vm, key: key };

                return data[key];
            }

            function set(value) {

                if (data[key] !== value) {

                    /**
                     * If the new value is already a view model,
                     * we will assume that we shouldn't replace
                     * its bindings. Otherwise, if the new value 
                     * will be replacing an existing view model,
                     * we need to copy the bindings over to the 
                     * new value.
                     */
                    var alreadyVM = value && value._uav;

                    value = model(value);

                    if (!alreadyVM && data[key] && data[key]._uav) {

                        copyBindings(data[key], value);
                    }

                    /**
                     * Then we can actually store the new value on the vm.
                     */
                    data[key] = value;

                    /**
                     * If this model is an array, we can update any loops
                     * by replacing the children at the current index.
                     *
                     * If there are non-loop bindings to the array, remember
                     * that they are all stored on the first index, so we'll
                     * run those bindings regardless of which index is being
                     * accessed.
                     */
                    if (vm._loops) {

                        /**
                         * uav._pause is used in bind-array-methods.js to prevent
                         * rapid-fire renders during methods like Array.fill(), 
                         * which would otherwise trigger these bindings once for
                         * every index of the array.
                         */
                        if (!uav._pause) {

                            vm._loops.forEach(function (loop) {
                                return loop.replace(data[key], key);
                            });

                            runBindings(vm._uav, 0);
                        }

                        /**
                         * If the model is not an array, we can simply run the
                         * bindings for this property. 
                         */
                    } else {

                        runBindings(vm._uav, key);
                    }
                }
            }

            data[key] = model(val);

            Object.defineProperty(vm, key, {
                get: get,
                set: set,
                configurable: true,
                enumerable: true
            });
        });

        Object.keys(data).forEach(function (key) {
            return vm._watch(data[key], key);
        });

        return vm;
    }

    /**
     * Convert an HTML string into an HTML tree.
     * Must have one root node.
     * 
     * @param  {String} html - the string to convert
     * @param  {Element} parent - the element's parent (optional).
     * @return {Element}
     */
    var parseHtml = function parseHtml(html, parent) {

        var el = parent ? parent.cloneNode() : document.createElement('div');

        el.innerHTML = html;

        if (el.children.length !== 1) {

            console.error('Template must have 1 root node:', html);
        }

        return el.firstElementChild;
    };

    /**
     * Convert a template expression into a function that
     * can be called with a view model as well as a parent
     * execution context (for template loops).
     *
     * Note that this approach does not have the security
     * concerns of eval(), because the template expressions
     * do not have access to the execution context.
     * 
     * @param  {String} expression - the template expression
     * @return {Function}
     */
    var parseExpression = function parseExpression(expression) {

        var evaluator = new Function('with(arguments[0]){with(arguments[1]){return ' + expression + '}}');

        return function (vm, ctx) {

            var result = void 0;

            try {

                result = evaluator(vm, ctx || {});
            } catch (err) {

                result = '';

                if (uav.warnings) {

                    console.warn(err, expression);
                }
            }

            return result === undefined || result === null ? '' : result;
        };
    };

    /**
     * Bind the contents of an array to a template.
     * 
     * @param  {Object} attribute - {name, value}
     * @param  {Array} steps      - rendering instructions
     * @param  {Element} node     - the parent of the loop
     * @return {undefined}
     */
    var loop = function loop(attribute, steps, node) {

        var loopVars = util.stripTags(attribute.value).split(' in ');

        var evaluate = parseExpression(loopVars[1]);

        var valueVars = loopVars[0].split(',');

        var as = valueVars[0].trim();

        var index = valueVars[1] ? valueVars[1].trim() : null;

        var childSteps = parseElement(node.firstElementChild);

        node.innerHTML = '';

        var binding = function binding(el) {
            return function (state) {

                Array.from(el.children).forEach(util.unbind);

                el.innerHTML = '';

                var list = model(evaluate(state.vm, state.ctx) || []);

                uav.state = null;

                function renderChild(item, i) {

                    var ctx = state.ctx ? Object.create(state.ctx) : {};

                    ctx[as] = item;

                    ctx[index] = i;

                    var child = util.render(childSteps, state.vm, ctx);

                    return child;
                }

                var loop = {

                    hasIndex: index,

                    add: function add(item, i) {

                        var child = renderChild(item, i);

                        el.appendChild(child);
                    },
                    insert: function insert(item, i) {

                        var child = renderChild(item, i);

                        el.insertBefore(child, el.children[i]);
                    },
                    remove: function remove(i) {

                        if (el.children[i]) {

                            util.unbind(el.children[i]);

                            el.children[i].remove();
                        }
                    },
                    replace: function replace(item, i) {

                        var childAtIndex = el.children[i];

                        var child = renderChild(item, i);

                        if (childAtIndex) {

                            util.unbind(childAtIndex);

                            el.replaceChild(child, childAtIndex);
                        } else {

                            el.appendChild(child);
                        }
                    }
                };

                list._loops.push(loop);

                /**
                 * Save a closure that will remove this binding,
                 * to be run if the node is removed or replaced.
                 */
                uav.node._uav.push(function () {

                    list._loops.splice(list._loops.indexOf(loop), 1);
                });

                list.forEach(loop.add);
            };
        };

        steps.push(function (state) {
            return util.bindStep(binding(state.el), state);
        });
    };

    /**
     * Two-way bind a radio input to an expression.
     * 
     * @param  {Array} steps       - rendering instructions
     * @param  {Function} evaluate - the curried expression evaluator
     * @return {undefined}
     */
    function bindRadio(steps, evaluate) {

        var binding = function binding(el) {
            return function (state) {

                el.checked = evaluate(state.vm, state.ctx).toString() === el.value;
            };
        };

        steps.push(function (state) {

            state.el.addEventListener('change', function () {

                evaluate(state.vm, state.ctx);

                uav.last.vm[uav.last.key] = state.el.value;

                uav.last = null;
            });

            util.bindStep(binding(state.el), state);

            return state;
        });
    }

    /**
     * Two-way bind a checkbox input to an expression.
     *
     * Individual checkboxes can be bound to booleans, or
     * groups of checkboxes can be bound to arrays.
     * 
     * @param  {Array} steps       - rendering instructions
     * @param  {Function} evaluate - the curried expression evaluator
     * @return {undefined}
     */
    function bindCheckbox(steps, evaluate) {

        var binding = function binding(el) {
            return function (state) {

                var value = evaluate(state.vm, state.ctx);

                uav.state = null;

                if (Array.isArray(value)) {

                    el.checked = value.map(String).indexOf(el.value) !== -1;
                } else {

                    el.checked = value ? true : false;
                }
            };
        };

        steps.push(function (state) {

            state.el.addEventListener('change', function () {

                var value = evaluate(state.vm, state.ctx);

                if (Array.isArray(value)) {

                    var index = value.indexOf(state.el.value);

                    if (index === -1 && state.el.checked) {

                        value.push(state.el.value);
                    } else if (index !== -1 && !state.el.checked) {

                        value.splice(index, 1);
                    }
                } else {

                    uav.last.vm[uav.last.key] = state.el.checked;
                }

                uav.last = null;

                return state;
            });

            var value = evaluate(state.vm, state.ctx);

            if (Array.isArray(value)) {

                var updateCheckbox = function updateCheckbox() {
                    return binding(state.el)(state);
                };

                value._loops.push({
                    add: updateCheckbox,
                    remove: updateCheckbox,
                    replace: updateCheckbox
                });
            }

            return util.bindStep(binding(state.el), state);
        });
    }

    /**
     * Two-way bind an input to an expression.
     * 
     * @param  {Array} steps       - rendering instructions
     * @param  {Function} evaluate - the curried expression evaluator
     * @return {undefined}
     */
    function bindInput(steps, evaluate) {

        var binding = function binding(el) {
            return function (state) {

                el.value = evaluate(state.vm, state.ctx);
            };
        };

        steps.push(function (state) {

            state.el.addEventListener('input', function () {

                evaluate(state.vm, state.ctx);

                uav.last.vm[uav.last.key] = state.el.value;

                uav.last = null;
            });

            util.bindStep(binding(state.el), state);

            return state;
        });
    }

    /**
     * Two-way bind an input to an expression.
     * 
     * @param  {Object} attribute - {name, value}
     * @param  {Array} steps      - rendering instructions
     * @param  {Element} node     - the input
     * @return {undefined}
     */
    var twoWayBind = function twoWayBind(attribute, steps, node) {

        var evaluate = parseExpression(util.stripTags(attribute.value));

        switch (node.getAttribute('type')) {

            case 'radio':
                bindRadio(steps, evaluate);
                break;

            case 'checkbox':
                bindCheckbox(steps, evaluate);
                break;

            default:
                bindInput(steps, evaluate);

        }
    };

    /**
     * Parse and bind a boolean attribute, i.e.:
     * <input type="text" u-attr={disabled}/>
     * 
     * @param  {Object} attribute - {name, value}
     * @param  {Array} steps      - rendering instructions
     * @return {undefined}
     */
    function bindBooleanAttribute(attribute, steps) {

        var property = util.stripTags(attribute.value);

        var evaluate = parseExpression(property);

        var binding = function binding(el) {
            return function (state) {

                var value = evaluate(state.vm, state.ctx);

                if (property) {

                    el.removeAttribute(property);
                }

                if (value === false) {

                    return;
                }

                property = value === true ? property : value;

                if (property) {

                    el.setAttribute(property, '');
                }
            };
        };

        steps.push(function (state) {

            return util.bindStep(binding(state.el), state);
        });
    }

    /**
     * Parse and bind any expressions in an attribute.
     * There may be multiple expressions in one attribute.
     * 
     * @param  {Object} attribute - {name, value}
     * @param  {Array} steps      - rendering instructions
     * @return {undefined}
     */
    function bindAttribute(attribute, steps) {

        var expressions = attribute.value.match(uav.expRX);

        var codes = expressions.map(util.stripTags);

        var evaluators = codes.map(parseExpression);

        var template = attribute.value;

        var name = attribute.name.substring(2);

        var binding = function binding(el) {
            return function (state) {

                var result = template;

                for (var i = 0; i < evaluators.length; i++) {

                    var value = evaluators[i](state.vm, state.ctx);

                    switch (typeof value) {

                        case 'function':

                            el[name] = value;

                            return;

                        case 'boolean':

                            value = value ? codes[i] : '';

                    }

                    result = result.replace(expressions[i], value);
                }

                el.setAttribute(name, result);
            };
        };

        steps.push(function (state) {

            return util.bindStep(binding(state.el), state);
        });
    }

    /**
     * Check to see if an attribute should be parsed,
     * and if so, whether it is a special case.
     * 
     * @param  {Object} attribute - {name, value}
     * @param  {Array} steps      - rendering instructions
     * @param  {Element} node     - the node which has this attribute
     * @return {undefined}
     */
    function parseAttribute(attribute, steps, node) {

        if (attribute.name.indexOf('u-') === 0) {

            attribute = {
                name: attribute.name,
                value: attribute.value
            };

            node.removeAttribute(attribute.name);

            switch (attribute.name) {

                case 'u-for':

                    return loop(attribute, steps, node);

                case 'u-attr':

                    return bindBooleanAttribute(attribute, steps);

                case 'u-bind':

                    return twoWayBind(attribute, steps, node);

            }

            bindAttribute(attribute, steps);
        } else {

            steps.push(function (state) {

                state.el.setAttribute(attribute.name, attribute.value);

                return state;
            });
        }
    }

    /**
     * Bind a text node to an expression.
     * 
     * @param  {Array} steps       - rendering instructions
     * @param  {String} expression - the template expression
     * @return {undefined}
     */
    function bindTextNode(steps, expression) {

        var evaluate = parseExpression(expression);

        var binding = function binding(node) {
            return function (state) {

                var value = evaluate(state.vm, state.ctx);

                if (value && (value._el || value.tagName)) {

                    var newNode = value._el ? value._el : value;

                    if (newNode !== node) {

                        util.unbind(node);
                    }

                    if (node.parentNode) {

                        node.parentNode.replaceChild(newNode, node);

                        node = newNode;
                    }
                } else {

                    node.textContent = value;
                }
            };
        };

        steps.push(function (state) {

            var node = document.createTextNode('');

            state.el.appendChild(node);

            return util.bindStep(binding(node), state);
        });
    }

    /**
     * Parse and bind a text node. Because
     * an expression can contain a child component
     * or an HTML element, we need to create an individual
     * text node for each expression.
     * 
     * @param  {Element} node - the text node
     * @param  {Array} steps  - rendering instructions
     * @return {undefined}
     */
    function parseTextNode(node, steps) {

        var parts = node.textContent.split(uav.expRX);

        if (parts.length > 1) {

            parts.forEach(function (part) {

                if (part.trim()) {

                    var newNode = document.createTextNode(part);

                    if (part.match(uav.expRX)) {

                        bindTextNode(steps, util.stripTags(part));
                    } else {

                        steps.push(function (state) {

                            state.el.appendChild(newNode.cloneNode());

                            return state;
                        });
                    }
                }
            });
        } else {

            var text = node.textContent;

            steps.push(function (state) {

                state.el.appendChild(document.createTextNode(text));

                return state;
            });
        }
    }

    /**
     * Walk an element's attributes and children to check
     * for template expressions and construct a list of
     * steps for efficiently re-rendering the component.
     * 
     * @param  {Element} node - the node to walk
     * @return {Array} steps  - rendering instructions
     */
    function parseElement(node) {

        var steps = [];

        steps.root = function () {
            return node.cloneNode();
        };

        Array.from(node.attributes).forEach(function (attribute) {

            parseAttribute(attribute, steps, node);
        });

        if (node.value) {

            parseAttribute({
                name: 'value',
                value: node.value
            }, steps, node);
        }

        Array.from(node.childNodes).forEach(function (child) {

            if (child.nodeType === 3) {

                parseTextNode(child, steps);
            } else {

                var childSteps = parseElement(child);

                steps.push(function (state) {

                    state.el.appendChild(util.render(childSteps, state.vm, state.ctx));

                    return state;
                });
            }
        });

        return steps;
    }

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
    var component = function component(html, vm, parent) {
        var _arguments = arguments;


        var node = parseHtml(html.innerHTML || html);

        if (!vm) {

            return node;
        }

        /**
         * parseElement returns a list of functions called "steps"
         * that, when run in sequence, construct a data-bound clone
         * of the node.
         */
        var steps = parseElement(node);

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

        var _loop3 = function _loop3(i) {

            if (typeof _arguments[i] === 'function') {

                setTimeout(function () {
                    return _arguments[i](vm._el);
                });

                return 'break';
            }
        };

        for (var i = 1; i < arguments.length; i++) {
            var _ret3 = _loop3(i);

            if (_ret3 === 'break') break;
        }

        return vm;
    };

    /**
     * Polyfill Array.from for IE. The Babel polyfill
     * for spread syntax is too verbose.
     */
    if (!Array.from) {

        Array.from = function (object) {

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
})();
