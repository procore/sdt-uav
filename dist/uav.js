function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

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

                if (node._uav.length) {
                    console.log('removing ' + node._uav.length + ' bindings');
                }

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

            uav.state = Object.assign({}, state, { binding: binding });

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
        },


        /**
         * Create a DOM element with the given tag name.
         * @param  {String} tag - the tag name
         * @return {Element}
         */
        createElement: function createElement(tag) {

            if (tag === 'svg' || tag === 'path') {

                return document.createElementNS('http://www.w3.org/2000/svg', tag);
            }

            return document.createElement(tag);
        }
    };

    var parseHtml = function parseHtml(html, parent) {

        var el = parent ? parent.cloneNode() : document.createElement('div');

        el.innerHTML = html;

        if (el.children.length !== 1) {

            console.error('Template must have 1 root node:', html);
        }

        return el.firstElementChild;
    };

    /**
     * Wrap all array methods that modify the length
     * of the array, so that the appropriate cleanup
     * or binding is triggered.
     * 
     * @param  {Array} list - the array to modify
     * @return {undefined}
     */
    var bindArrayMethods = function bindArrayMethods(list) {

        util.defineProp(list, 'push', function () {
            for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
                args[_key] = arguments[_key];
            }

            var startIndex = list.length;

            args.forEach(function (arg) {
                return list._watch(arg, list.length);
            });

            list._loops.forEach(function (loop) {

                args.forEach(function (arg, i) {

                    loop.append(arg, startIndex + i);
                });
            });

            return list;
        });

        util.defineProp(list, 'pop', function () {

            list._loops.forEach(function (loop) {
                return loop.remove(list.length - 1);
            });

            return Array.prototype.pop.call(list);
        });

        util.defineProp(list, 'shift', function () {

            list._loops.forEach(function (loop) {
                return loop.remove(0);
            });

            return Array.prototype.shift.call(list);
        });

        util.defineProp(list, 'splice', function () {
            for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
                args[_key2] = arguments[_key2];
            }

            var originalLength = list.length;

            var start = args.shift();

            var deleteCount = args.shift();

            var result = Array.prototype.splice.apply(list, [start, deleteCount].concat(args));

            var _loop = function _loop(i) {

                list._watch(list[i], i);

                list._loops.forEach(function (loop) {
                    return loop.append(list[i], i);
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

        util.defineProp(list, 'unshift', function () {
            for (var _len3 = arguments.length, args = Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
                args[_key3] = arguments[_key3];
            }

            var originalLength = list.length;

            Array.prototype.unshift.apply(list, args);

            var _loop3 = function _loop3(i) {

                list._watch(list[i], i);

                list._loops.forEach(function (loop) {
                    return loop.append(list[i], i);
                });
            };

            for (var i = originalLength; i < list.length; i++) {
                _loop3(i);
            }

            return list;
        });
    };

    /**
     * Recursively copy all bindings from one model
     * to another.
     * 
     * @param  {Object} from - the old object
     * @param  {Object} to   - the new object
     * @return {Object}      - the new object
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
     * Adds getters and setters to all properties
     * of an object so that view bindings will be
     * executed if the properties are modified.
     * 
     * @param  {Object|Array} data - the source for the model
     * @return {Object}            - the bound model
     */
    function model(data) {

        if (!data || typeof data !== 'object' || data._uav || data.tagName) {

            return data;
        }

        var vm = {};

        if (Array.isArray(data)) {

            vm = [];

            util.defineProp(vm, '_loops', []);

            bindArrayMethods(vm);
        }

        util.defineProp(vm, '_uav', {});

        util.defineProp(vm, '_watch', function (val, key) {

            function get() {

                if (uav.state) {

                    var state = uav.state;

                    vm._uav[key] = vm._uav[key] || [];

                    vm._uav[key].push(state);

                    uav.node._uav.push(function () {

                        if (vm._uav[key]) {

                            var index = vm._uav[key].indexOf(state);

                            vm._uav[key].splice(index, 1);
                        }

                        state = null;
                    });
                }

                uav.lastAccessed = { vm: vm, key: key };

                return data[key];
            }

            function set(value) {

                if (data[key] !== value) {

                    var alreadyVM = value && value._uav;

                    value = model(value);

                    if (!alreadyVM && data[key] && data[key]._uav) {

                        copyBindings(data[key], value);
                    }

                    data[key] = value;

                    if (vm._loops) {

                        vm._loops.forEach(function (loop) {
                            return loop.replace(data[key], key);
                        });
                    }

                    if (vm._uav[key]) {

                        vm._uav[key].forEach(function (state) {

                            state.binding(state);
                        });
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

    var parseExpression = function parseExpression(expression) {

        var evaluator = new Function('with(arguments[0]){with(arguments[1]){return ' + expression + '}}');

        return function (vm, ctx) {

            var result = void 0;

            try {

                //result = evaluator(vm, ctx ? ctx() : {});

                result = evaluator(vm, ctx || {});
            } catch (err) {

                result = '';
            }

            return result;
        };
    };

    var loop = function loop(attribute, steps, node) {

        var loopVars = util.stripTags(attribute.value).split(' as ');

        var evaluate = parseExpression(loopVars[0]);

        var valueVars = loopVars[1].split(',');

        var as = valueVars[0].trim();

        var index = valueVars[1] ? valueVars[1].trim() : null;

        node.removeAttribute('u-for');

        var childSteps = parseElement(node.firstElementChild);

        node.innerHTML = '';

        var binding = function binding(el) {
            return function (state) {

                Array.from(el.children).forEach(util.unbind);

                el.innerHTML = '';

                var list = model(evaluate(state.vm, state.ctx) || []);

                uav.state = null;

                function renderChild(item, i) {
                    var _Object$assign;

                    return util.render(childSteps, state.vm, Object.assign({}, state.ctx, (_Object$assign = {}, _defineProperty(_Object$assign, as, item), _defineProperty(_Object$assign, index, i), _Object$assign)));
                }

                var loop = {
                    append: function append(item, i) {

                        var child = renderChild(item, i);

                        el.appendChild(child);
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

                list.forEach(loop.append);
            };
        };

        steps.push(function (state) {

            return util.bindStep(binding(state.el), state);
        });
    };

    function bindRadio(steps, evaluate) {

        var binding = function binding(el) {
            return function (state) {

                el.checked = evaluate(state.vm, state.ctx).toString() === el.value;
            };
        };

        steps.push(function (state) {

            state.el.addEventListener('change', function () {

                evaluate(state.vm, state.ctx);

                uav.lastAccessed.vm[uav.lastAccessed.key] = state.el.value;

                uav.lastAccessed = null;
            });

            util.bindStep(binding(state.el), state);

            return state;
        });
    }

    function bindCheckbox(steps, evaluate) {

        var binding = function binding(el) {
            return function (state) {

                var value = evaluate(state.vm, state.ctx);

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

                    uav.lastAccessed.vm[uav.lastAccessed.key] = state.el.checked;
                }

                uav.lastAccessed = null;

                return state;
            });

            var value = evaluate(state.vm, state.ctx);

            if (Array.isArray(value)) {

                var updateCheckbox = function updateCheckbox() {
                    return binding(state.el)(state);
                };

                value._loops.push({
                    append: updateCheckbox,
                    remove: updateCheckbox,
                    replace: updateCheckbox
                });
            }

            return util.bindStep(binding(state.el), state);
        });
    }

    function bindInput(steps, evaluate) {

        var binding = function binding(el) {
            return function (state) {

                el.value = evaluate(state.vm, state.ctx);
            };
        };

        steps.push(function (state) {

            state.el.addEventListener('input', function () {

                evaluate(state.vm, state.ctx);

                uav.lastAccessed.vm[uav.lastAccessed.key] = state.el.value;

                uav.lastAccessed = null;
            });

            util.bindStep(binding(state.el), state);

            return state;
        });
    }

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

    function parseAttribute(attribute, steps, node) {

        if (attribute.name.indexOf('u-') === 0) {

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

    function bindTextNode(_node, steps, expression) {

        var evaluate = parseExpression(expression);

        var binding = function binding(node) {
            return function (state) {

                var value = evaluate(state.vm, state.ctx);

                if (value._el || value.tagName) {

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

    function parseTextNode(node, steps) {

        var parts = node.textContent.split(uav.expRX);

        if (parts.length > 1) {

            parts.forEach(function (part) {

                if (part.trim()) {

                    var newNode = document.createTextNode(part);

                    if (part.match(uav.expRX)) {

                        bindTextNode(newNode, steps, util.stripTags(part));
                    } else {

                        steps.push(function (state) {

                            state.el.appendChild(newNode.cloneNode());

                            return state;
                        });
                    }
                }
            });
        } else {

            steps.push(function (state) {

                state.el.appendChild(node.cloneNode());

                return state;
            });
        }
    }

    function parseElement(node) {

        var steps = [];

        steps.root = function () {
            return util.createElement(node.tagName);
        };

        for (var i = 0; i < node.attributes.length; i++) {

            parseAttribute(node.attributes[i], steps, node);
        }

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


        var node = html.tagName ? html : parseHtml(html);

        var steps = parseElement(node);

        vm = model(vm);

        vm._el = util.render(steps, vm);

        if (parent) {

            if (typeof parent === 'string') {

                parent = uav(parent);

                parent.innerHTML = '';
            }

            if (parent.appendChild) {

                parent.appendChild(vm._el);
            }
        }

        var _loop4 = function _loop4(i) {

            if (typeof _arguments[i] === 'function') {

                setTimeout(function () {
                    return _arguments[i](vm._el);
                });

                return 'break';
            }
        };

        for (var i = 1; i < arguments.length; i++) {
            var _ret4 = _loop4(i);

            if (_ret4 === 'break') break;
        }

        return vm;
    };

    /**
     * Polyfill Array.from for IE. The Babel polyfill
     * for spread syntax is too verbose.
     */
    if (!Array.from) {

        Array.from = function (object) {

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
})();
