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

var parseHtml = (html, parent) => {

    const el = parent ? parent.cloneNode() : document.createElement('div');

    el.innerHTML = html;

    if (el.children.length !== 1) {

        console.error('Template must have 1 root node:', html);

    }

    return el.firstElementChild;

};

var bindArrayMethods = list => {

    util.defineProp(list, 'push', (...args) => {

        const startIndex = list.length;

        args.forEach(arg => list._watch(arg, list.length));

        list._loops.forEach(loop => {

            args.forEach((arg, i) => {

                loop.append(arg, startIndex + i);

            });

        });

        return list;

    });

    util.defineProp(list, 'pop', () => {

        list._loops.forEach(loop => loop.remove(list.length - 1));

        return Array.prototype.pop.call(list);

    });

    util.defineProp(list, 'shift', () => {

        list._loops.forEach(loop => loop.remove(0));

        return Array.prototype.shift.call(list);

    });

    util.defineProp(list, 'splice', (...args) => {

        const originalLength = list.length;

        const start = args.shift();

        const deleteCount = args.shift();

        const result = Array.prototype.splice.apply(list, [start, deleteCount].concat(args));

        for (let i = originalLength; i < list.length; i++) {

            list._watch(list[i], i);

            list._loops.forEach(loop => loop.append(list[i], i));

        }

        for (let i = list.length; i < originalLength; i++) {

            list._loops.forEach(loop => loop.remove(i));

        }

        return result;

    });

    util.defineProp(list, 'unshift', (...args) => {

        const originalLength = list.length;

        Array.prototype.unshift.apply(list, args);

        for (let i = originalLength; i < list.length; i++) {

            list._watch(list[i], i);

            list._loops.forEach(loop => loop.append(list[i], i));

        }

        return list;

    });

};

function copyBindings(from, to) {

    if (from && from._uav && to) {

        Object.keys(from).forEach(key => {

            copyBindings(from[key], to[key]);

        });

        to._uav = from._uav;

        from = null;

    }

}

function model(data) {

    if (!data || typeof data !== 'object' || data._uav || data._loops || data.tagName) {

        return data;

    }

    let vm = {};

    if (Array.isArray(data)) {

        vm = [];

        util.defineProp(vm, '_loops', []);

        bindArrayMethods(vm);

    } else {

        util.defineProp(vm, '_uav', {});

    }

    util.defineProp(vm, '_watch', (val, key) => {

        function get() {

            if (uav.state && vm._uav) {

                let state = uav.state;

                vm._uav[key] = vm._uav[key] || [];

                vm._uav[key].push(state);

                uav.node._uav.push(() => {

                    if (vm._uav[key]) {

                        const index = vm._uav[key].indexOf(state);

                        vm._uav[key].splice(index, 1);

                    }

                    state = null;

                });

            }

            uav.lastAccessed = {vm, key};

            return data[key];

        }

        function set(value) {

            if (data[key] !== value || typeof value === 'object') {

                const alreadyVM = value && value._uav;

                value = model(value);

                if (!alreadyVM && data[key] && data[key]._uav) {

                    copyBindings(data[key], value);

                }

                data[key] = value;

                if (vm._loops) {

                    vm._loops.forEach(loop => loop.replace(data[key], key));

                } else if (vm._uav[key]) {

                    vm._uav[key].forEach(state => state.binding(state));

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

var parseExpression = expression => {

    const evaluator = new Function(`with(arguments[0]){with(arguments[1]){return ${expression}}}`);

    return (vm, ctx) => {

        let result;

        try {

            result = evaluator(vm, ctx || {});

        } catch (err) {

            result = '';

        }

        return result;

    };

};

var loop = (attribute, steps, node) => {

    const loopVars = util.stripTags(attribute.value).split(' as ');

    const evaluate = parseExpression(loopVars[0]);

    const valueVars = loopVars[1].split(',');

    const as = valueVars[0].trim();

    const index = valueVars[1] ? valueVars[1].trim() : null;

    node.removeAttribute('u-for');

    const childSteps = parseElement(node.firstElementChild);

    node.innerHTML = '';

    const binding = el => state => {

        function renderChild(item, i) {

            return util.render(childSteps, state.vm, Object.assign({}, state.ctx, {
                [as]: item,
                [index]: i
            }));

        }

        const loop = {
            
            append(item, i) {

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

        const list = model(evaluate(state.vm, state.ctx) || []);

        list._loops.push(loop);

        uav.state = null;

        list.forEach(loop.append);

    };

    steps.push(state => {

        state.binding = binding(state.el);

        uav.state = state;

        state.binding(state);

        return state;

    });

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

        el.setAttribute(property, '');

    };

    steps.push(state => {

        return util.bindStep(binding(state.el), state);

    });

}

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

function parseAttribute(attribute, steps, node) {

    if (attribute.name.indexOf('u-') === 0) {

        switch (attribute.name) {

        case 'u-for':

            return loop(attribute, steps, node);

        case 'u-attr':

            return bindBooleanAttribute(attribute, steps);

        }
        
        bindAttribute(attribute, steps);

    } else {

        steps.push(state => {

            state.el.setAttribute(attribute.name, attribute.value);

            return state;

        });

    }

}

function bindTextNode(_node, steps, expression) {

    const evaluate = parseExpression(expression);

    const binding = node => state => {

        const value = evaluate(state.vm, state.ctx);

        if (value._el || value.tagName) {

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

        }

    };

    steps.push(state => {

        const node = document.createTextNode('');

        state.el.appendChild(node);

        return util.bindStep(binding(node), state);

    });

}

function parseTextNode(node, steps) {

    const parts = node.textContent.split(uav.expRX);

    if (parts.length > 1) {

        parts.forEach(part => {

            if (part.trim()) {

                const newNode = document.createTextNode(part);

                if (part.match(uav.expRX)) {

                    bindTextNode(newNode, steps, util.stripTags(part));

                } else {

                    steps.push(state => {

                        state.el.appendChild(newNode.cloneNode());

                        return state;

                    });

                }

            }

        });

    } else {

        steps.push(state => {

            state.el.appendChild(node.cloneNode());

            return state;

        });

    }

}

function parseElement(node) {

    uav.node = node;

    util.defineProp(uav.node, '_uav', []);

    const steps = [];

    steps.root = () => util.createElement(node.tagName);

    for (let i = 0; i < node.attributes.length; i++) {

        parseAttribute(node.attributes[i], steps, node);

    }

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

    const node = html.tagName ? html : parseHtml(html);

    const steps = parseElement(node);

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

        return [].slice.call(object);

    };

}

util.setTag('{', '}');

uav.component = component;
uav.model = model;
uav.parse = parseHtml;
uav.setTag = util.setTag;

window.uav = uav;

}());
