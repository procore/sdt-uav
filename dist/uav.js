(function () {
'use strict';

function all(selector, callback) {

    const els = Array.from(document.querySelectorAll(selector));

    if (callback) {

        return els.forEach(callback);

    }

    return els;

}

const uav = window.uav = (selector, callback) => {

    if (callback) {

        return all(selector, callback);

    }

    return document.querySelector(selector) || document.createElement('div');

};

const util = {

    defineProp: (vm, prop, value) => Object.defineProperty(vm, prop, {
        value,
        configurable: true,
        writable: true,
        enumerable: false
    }),

    unbind(node) {

        if (node && node._uav) {

            Array.from(node.children).forEach(util.unbind);

            node._uav.forEach(fn => fn());

            node = null;

        }

    },

    setTag(open, close) {

        uav.tagRX = new RegExp(`(^${open}|${close}$)`, 'g');

        uav.expRX =  new RegExp(`(${open}.*?${close})`, 'g');

    },

    stripTags: str => str.replace(uav.tagRX, ''),

    bindStep(binding, step) {

        uav.binding = binding;

        binding.ctx = step.ctx;

        binding(step.vm, step);

        uav.binding = null;

        return step;

    },

    render(steps, vm, ctx) {

        const firstStep = [{
            vm,
            ctx,
            el: steps.root()
        }];

        return firstStep
            .concat(steps)
            .reduce((a, b) => b(a)).el;

    },

    isVmEligible(data) {

        return !(!data || typeof data !== 'object' || data._uav || data.tagName);

    }

};

var parse = {

    expression(expression) {

        const evaluator = new Function(`with(arguments[0]){with(arguments[1]){return ${expression}}}`);

        return (vm, ctx) => {

            let result;

            try {

                result = evaluator(vm, ctx || {});

            } catch (err) {

                console.error(expression, err);

                result = '';

            }

            return result;

        };

    },

    html(html, parent) {

        const el = parent ? parent.cloneNode() : document.createElement('div');

        el.innerHTML = html;

        if (el.children.length !== 1) {

            console.error('Template must have 1 root node:', html);

        }

        return el.firstElementChild;

    }

};

function model(data) {

    if (!util.isVmEligible(data)) {

        return data;

    }

    let vm = {};

    if (Array.isArray(data)) {

        vm = [];

        util.defineProp(vm, '_loops', []);

    } else {

        util.defineProp(vm, '_uav', {});

    }

    Object.keys(data).forEach(key => {

        function get() {

            if (uav.binding && vm._uav) {

                let binding = uav.binding;

                vm._uav[key] = vm._uav[key] || [];

                vm._uav[key].push(binding);

                uav.node._uav.push(() => {

                    if (vm._uav[key]) {

                        const index = vm._uav[key].indexOf(binding);

                        vm._uav[key].splice(index, 1);

                    }

                    binding = null;

                });

            }

            uav.lastAccessed = {vm, key};

            return data[key];

        }

        function set(value) {

            data[key] = model(value);

            if (vm._loops) {

                vm._loops.forEach(loop => loop.replace(data[key], key));

            } else if (vm._uav[key]) {

                vm._uav[key].forEach(binding => binding(vm, binding));

            }

        }

        data[key] = model(data[key]);

        Object.defineProperty(vm, key, {
            get,
            set,
            configurable: true,
            enumerable: true
        });

    });

    return vm;

}

var loop = (attribute, steps, node) => {

    const evaluate = parse.expression(attribute.value);

    const loopVars = node.getAttribute('uav-as').split(',');

    const as = loopVars[0];

    const index = loopVars[1];

    node.removeAttribute('uav-loop');

    node.removeAttribute('uav-as');

    const childSteps = element.parse(node.firstElementChild);

    node.innerHTML = '';

    const binding = el => (vm, state) => {

        const loop = {
            
            append(item, i) {

                const child = util.render(childSteps, vm, {
                    [as]: item,
                    [index]: i
                });

                el.appendChild(child);

            },

            replace(item, i) {

                const childAtIndex = el.children[i];

                const child = util.render(childSteps, vm, {
                    [as]: item,
                    [index]: i
                });

                if (childAtIndex) {

                    util.unbind(childAtIndex);

                    el.replaceChild(child, childAtIndex);

                } else {

                    el.appendChild(child);

                }

            }

        };

        el.innerHTML = '';

        const list = model(evaluate(vm, state.ctx) || []);

        list._loops.push(loop);

        uav.binding = null;

        list.forEach(loop.append);

    };

    steps.push(state => {

        uav.binding = binding(state.el);

        uav.binding.ctx = state.ctx;

        uav.binding(state.vm, state);

        return state;

    });

};

function bindAttribute(attribute, expressions, steps) {

    const codes = expressions.map(util.stripTags);

    const evaluators = codes.map(parse.expression);

    const template = attribute.value;

    const binding = el => (vm, state) => {

        let result = template;

        for (let i = 0; i < evaluators.length; i++) {

            let value = evaluators[i](vm, state.ctx);

            if (typeof value === 'function') {

                el[attribute.name] = value;

                return;

            } else if (typeof value === 'boolean') {

                value = value ? codes[i] : '';

            }

            result = result.replace(expressions[i], value);

        }

        el.setAttribute(attribute.name, result);

    };

    steps.push(state => {

        return util.bindStep(binding(state.el), state);

    });

}

function parseAttribute(attribute, steps, node) {

    if (attribute.name === 'uav-loop') {

        loop(attribute, steps, node);

    } else {

        const expressions = attribute.value.match(uav.expRX);

        if (expressions) {

            bindAttribute(attribute, expressions, steps);

        } else {

            steps.push(state => {

                state.el.setAttribute(attribute.name, attribute.value);

                return state;

            });

        }

    }

}

var attribute = {
    parse: parseAttribute
};

function bindTextNode(_node, steps, expression) {

    const evaluate = parse.expression(expression);

    const binding = node => (vm, state) => {

        const value = evaluate(vm, state.ctx);

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

        const parent = node.parentNode;

        parts.forEach(part => {

            if (part.trim()) {

                const newNode = document.createTextNode(part);

                if (part.match(uav.expRX)) {

                    bindTextNode(newNode, steps, util.stripTags(part));

                } else {

                    steps.push(state => {

                        state.el.appendChild(newNode);

                        return state;

                    });

                }

            }

        });

        parent.removeChild(node);

    } else {

        steps.push(state => {

            state.el.appendChild(node.cloneNode());

            return state;

        });

    }

}

var textNode = {
    parse: parseTextNode
};

function parseElement(node) {

    uav.node = node;

    util.defineProp(uav.node, '_uav', []);

    const steps = [];

    steps.root = () => document.createElement(node.tagName, node.parentNode);

    Array.from(node.attributes).forEach(attr => attribute.parse(attr, steps, node));
    
    Array.from(node.childNodes).forEach(child => {

        if (child.nodeType === 3) {

            textNode.parse(child, steps); 
        
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

var element = {
    parse: parseElement
};

var component = template => {

    const node = template.tagName ? template : parse.html(template);

    const steps = element.parse(node);

    return (vm, selector) => {

        vm = model(vm);

        const el = util.render(steps, vm);

        if (selector) {

            if (typeof selector === 'string') {

                const parent = uav(selector);

                parent.innerHTML = '';

                parent.appendChild(el);

            } else {

                selector.appendChild(el);

            }

        } else {

            vm._el = el;

        }

        for (let i = 1; i < arguments.length; i++) {
        
            if (typeof arguments[i] === 'function') {

                setTimeout(() => arguments[i](el));

                break;

            }

        }

        return vm;

    };

};

util.setTag('{', '}');

uav.parse = parse.html;
uav.component = component;
uav.model = model;

}());
