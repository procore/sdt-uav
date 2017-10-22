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
    render(steps, vm, ctx) {

        uav.node = steps.root();

        util.defineProp(uav.node, '_uav', []);

        return [{
            vm,
            ctx,
            el: uav.node
        }].concat(steps).reduce((a, b) => b(a)).el;

    }

};

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
var bindArrayMethods = (list, runBindings) => {

    util.defineProp(list, 'fill', (value, start = 0, end = list.length) => {

        uav._pause = true;

        while (start < 0) {

            start += list.length;

        }

        while (end < 0) {

            end += list.length;

        }

        runMethod(list, 'fill', [value, start, end]);

        for (let i = list.length; i < end; i++) {

            list._watch(value, i);

            list._loops.forEach(loop => loop.add(value, i));

        }

        runBindings();

        delete uav._pause;

        return list;

    });

    util.defineProp(list, 'push', (...args) => {

        const startIndex = list.length;

        runMethod(list, 'push', args);

        for (let i = startIndex; i < startIndex + args.length; i++) {

            list._watch(list[i], i);

            list._loops.forEach(loop => loop.add(list[i], i));

        }

        runBindings();

        return list;

    });

    util.defineProp(list, 'pop', () => {

        const lastIndex = list.length - 1;

        list._loops.forEach(loop => loop.remove(lastIndex));

        const result = runMethod(list, 'pop');

        runBindings();

        return result;

    });

    util.defineProp(list, 'reverse', () => {

        uav._pause = true;

        runMethod(list, 'reverse');
        
        runBindings();

        delete uav._pause;

        return list;

    });

    util.defineProp(list, 'shift', () => {

        list._loops.forEach(loop => loop.remove(0));

        const result = runMethod(list, 'shift');

        runBindings();

        return result;

    });

    util.defineProp(list, 'sort', compare => {

        uav._pause = true;

        const result = runMethod(list, 'sort', [compare]);
        
        runBindings();

        delete uav._pause;

        return result;

    });

    util.defineProp(list, 'splice', (...args) => {

        uav._pause = true;

        const originalLength = list.length;

        const result = runMethod(list, 'splice', [args.shift(), args.shift()].concat(args));

        for (let i = originalLength; i < list.length; i++) {

            list._watch(list[i], i);

            list._loops.forEach(loop => loop.add(list[i], i));

        }

        for (let i = list.length; i < originalLength; i++) {

            list._loops.forEach(loop => loop.remove(i));

        }

        runBindings();

        delete uav._pause;

        return result;

    });

    util.defineProp(list, 'unshift', (...args) => {

        const originalLength = list.length;

        runMethod(list, 'unshift', args);

        for (let i = originalLength; i < list.length; i++) {

            list._watch(list[i], i);

            list._loops.forEach(loop => loop.add(list[i], i));

        }

        runBindings();

        return list;

    });

};

function notVmEligible(data) {

    return !data || typeof data !== 'object' || data.tagName;

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

        bindings[key].forEach(state => state.binding(state));

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

        Object.keys(from).forEach(key => {

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

    if (notVmEligible(data) || data._uav) {

        return data;

    }

    let vm = {};

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
        bindArrayMethods(vm, () => runBindings(vm._uav, 0));

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
    util.defineProp(vm, '_watch', (val, key) => {

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

                let state = uav.state;

                vm._uav[key] = vm._uav[key] || [];

                vm._uav[key].push(state);

                /**
                 * Save a closure that will remove this binding,
                 * to be run if the node is removed or replaced.
                 */
                uav.node._uav.push(() => {

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
            uav.last = {vm, key};

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
                const alreadyVM = value && value._uav;

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

                    vm._loops.forEach(loop => loop.replace(data[key], key));

                    /**
                     * uav._pause is used in bind-array-methods.js to prevent
                     * rapid-fire renders during methods like Array.fill(), 
                     * which would otherwise trigger these bindings once for
                     * every index of the array.
                     */
                    if (!uav._pause) {

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
            get,
            set,
            configurable: true,
            enumerable: true
        });

    });

    Object.keys(data).forEach(key => vm._watch(data[key], key));

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
var parseHtml = (html, parent) => {

    const el = parent ? parent.cloneNode() : document.createElement('div');

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
var parseExpression = expression => {

    const evaluator = new Function(`with(arguments[0]){with(arguments[1]){return ${expression}}}`);

    return (vm, ctx) => {

        let result;

        try {

            result = evaluator(vm, ctx || {});

        } catch (err) {

            result = '';

        }

        return result === undefined || result === null ? '' : result;

    };

};

var loop = (attribute, steps, node) => {

    const loopVars = util.stripTags(attribute.value).split(' as ');

    const evaluate = parseExpression(loopVars[0]);

    const valueVars = loopVars[1].split(',');

    const as = valueVars[0].trim();

    const index = valueVars[1] ? valueVars[1].trim() : null;

    const childSteps = parseElement(node.firstElementChild);

    node.innerHTML = '';

    const binding = el => state => {

        Array.from(el.children).forEach(util.unbind);

        el.innerHTML = '';

        const list = model(evaluate(state.vm, state.ctx) || []);

        uav.state = null;

        function renderChild(item, i) {

            const ctx = state.ctx ? Object.create(state.ctx) : {};

            ctx[as] = item;

            ctx[index] = i;

            const child = util.render(childSteps, state.vm, ctx);

            return child;

        }

        const loop = {
            
            add(item, i) {

                const child = renderChild(item, i);

                el.appendChild(child);

            },

            remove(i) {

                if (el.children[i]) {

                    util.unbind(el.children[i]);

                    el.children[i].remove();

                }

            },

            replace(item, i) {

                const childAtIndex = el.children[i];

                const child = renderChild(item, i);

                if (childAtIndex) {

                    util.unbind(childAtIndex);

                    el.replaceChild(child, childAtIndex);

                } else {

                    el.appendChild(child);

                }

            }

        };

        list._loops.push(loop);

        list.forEach(loop.add);

    };

    steps.push(state => util.bindStep(binding(state.el), state));

};

function bindRadio(steps, evaluate) {

    const binding = el => state => {

        el.checked = evaluate(state.vm, state.ctx).toString() === el.value;

    };

    steps.push(state => {

        state.el.addEventListener('change', () => {

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

    const binding = el => state => {

        const value = evaluate(state.vm, state.ctx);

        uav.state = null;

        if (Array.isArray(value)) {

            el.checked = value.map(String).indexOf(el.value) !== -1;

        } else {

            el.checked = value ? true : false;

        }

    };

    steps.push(state => {

        state.el.addEventListener('change', () => {

            const value = evaluate(state.vm, state.ctx);

            if (Array.isArray(value)) {

                const index = value.indexOf(state.el.value);

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

        const value = evaluate(state.vm, state.ctx);

        if (Array.isArray(value)) {

            const updateCheckbox = () => binding(state.el)(state);
             
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

    const binding = el => state => {

        el.value = evaluate(state.vm, state.ctx);

    };

    steps.push(state => {

        state.el.addEventListener('input', () => {

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
var twoWayBind = (attribute, steps, node) => {

    const evaluate = parseExpression(util.stripTags(attribute.value));

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

    let property = util.stripTags(attribute.value);

    const evaluate = parseExpression(property);

    const binding = el => state => {

        const value = evaluate(state.vm, state.ctx);

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

    steps.push(state => {

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

    const expressions = attribute.value.match(uav.expRX);

    const codes = expressions.map(util.stripTags);

    const evaluators = codes.map(parseExpression);

    const template = attribute.value;

    const name = attribute.name.substring(2);

    const binding = el => state => {

        let result = template;

        for (let i = 0; i < evaluators.length; i++) {

            let value = evaluators[i](state.vm, state.ctx);

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

    steps.push(state => {

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

        steps.push(state => {

            state.el.setAttribute(attribute.name, attribute.value);

            return state;

        });

    }

}

function bindTextNode(steps, expression) {
    
    const evaluate = parseExpression(expression);

    const binding = node => state => {

        const value = evaluate(state.vm, state.ctx);

        if (value && (value._el || value.tagName)) {

            const newNode = value._el ? value._el : value;

            if (newNode !== node) {

                util.unbind(node);

            }

            if (node.parentNode) {

                node.parentNode.replaceChild(newNode, node);

                node = newNode;

            }

        } else {
            
            node.textContent = value;
            console.log('set text to ' + node.textContent);
        }

    };

    steps.push(state => {

        const node = document.createTextNode('');

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

    const parts = node.textContent.split(uav.expRX);

    if (parts.length > 1) {

        parts.forEach(part => {

            if (part.trim()) {

                const newNode = document.createTextNode(part);

                if (part.match(uav.expRX)) {

                    bindTextNode(steps, util.stripTags(part));

                } else {

                    steps.push(state => {

                        state.el.appendChild(newNode.cloneNode());

                        return state;

                    });

                }

            }

        });

    } else {

        const text = node.textContent;

        steps.push(state => {

            state.el.appendChild(document.createTextNode(text));

            return state;

        });

    }

}

function parseElement(node) {

    const steps = [];

    steps.root = () => node.cloneNode();

    Array.from(node.attributes).forEach(attribute => {

        parseAttribute(attribute, steps, node);

    });

    if (node.value) {

        parseAttribute({
            name: 'value',
            value: node.value
        }, steps, node);

    }
    
    Array.from(node.childNodes).forEach(child => {

        if (child.nodeType === 3) {

            parseTextNode(child, steps); 
        
        } else {

            const childSteps = parseElement(child);

            steps.push(state => {

                state.el.appendChild(util.render(childSteps, state.vm, state.ctx));

                return state;

            });

        }

    });

    return steps;

}

var component = function(html, vm, parent) {

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

};

if (!Array.from) {

    Array.from = function(object) {

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

}());
