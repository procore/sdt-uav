import util from './util';
import uav from './uav';

let currentBinding;

let currentNode;

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

function setTag(open, close) {

    uav.tagRX = new RegExp(`(^${open}|${close}$)`, 'g');

    uav.expRX =  new RegExp(`(${open}.*?${close})`, 'g');

}

setTag('{', '}');

function unbind(node) {

    if (node && node._uav) {

        Array.from(node.children).forEach(unbind);

        node._uav.forEach(fn => fn());

        node = null;

    }

}

function expressionToEvaluator(expression) {

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

}

function parse(markup, parent) {

    const el = parent ? parent.cloneNode() : document.createElement('div');

    el.innerHTML = markup;

    if (el.children.length !== 1) {

        console.error('Template must have 1 root node:', markup);

    }

    return el.firstElementChild;

}

const stripTags = str => str.replace(uav.tagRX, '');

function bindStep(binding, step) {

    currentBinding = binding;

    binding.ctx = step.ctx;

    binding(step.vm, step);

    currentBinding = null;

    return step;

}

function bindAttribute(attribute, expressions, steps) {

    const codes = expressions.map(stripTags);

    const evaluators = codes.map(expressionToEvaluator);

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

        return bindStep(binding(state.el), state);

    });

}

function bindLoop(attribute, steps, node) {

    const evaluate = expressionToEvaluator(attribute.value);

    const loopVars = node.getAttribute('uav-as').split(',');

    const as = loopVars[0];

    const index = loopVars[1];

    node.removeAttribute('uav-loop');

    node.removeAttribute('uav-as');

    const childSteps = getSteps(node.firstElementChild);

    node.innerHTML = '';

    const binding = el => (vm, state) => {

        const loop = {
            
            append(item, i) {

                const child = render(childSteps, vm, {
                    [as]: item,
                    [index]: i
                });

                el.appendChild(child);

            },

            replace(item, i) {

                const childAtIndex = el.children[i];

                const child = render(childSteps, vm, {
                    [as]: item,
                    [index]: i
                });

                if (childAtIndex) {

                    el.replaceChild(child, childAtIndex);

                } else {

                    el.appendChild(child);

                }

            }

        };

        el.innerHTML = '';

        const list = model(evaluate(vm, state.ctx) || []);

        list._loops.push(loop);

        currentBinding = null;

        list.forEach(loop.append);

    };

    steps.push(state => {

        currentBinding = binding(state.el);

        currentBinding.ctx = state.ctx;

        currentBinding(state.vm, state);

        return state;

    });

}

function parseAttribute(attribute, steps, node) {

    if (attribute.name === 'uav-loop') {

        bindLoop(attribute, steps, node);

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

function bindTextNode(_node, steps, expression) {

    const evaluate = expressionToEvaluator(expression);

    const binding = node => (vm, state) => {

        const value = evaluate(vm, state.ctx);

        if (value._el || value.tagName) {

            const newNode = value._el ? value._el : value;

            if (newNode !== node) {

                unbind(node);

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

        return bindStep(binding(node), state);

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

                    bindTextNode(newNode, steps, stripTags(part));

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

function render(steps, vm, ctx) {

    return [{vm, ctx, el: steps.root()}]
        .concat(steps)
        .reduce((a, b) => b(a)).el;

}

function getSteps(node) {

    currentNode = node;

    util.defineProp(currentNode, '_uav', []);

    const steps = [];

    steps.root = () => document.createElement(node.tagName, node.parentNode);

    Array.from(node.attributes).forEach(attribute => parseAttribute(attribute, steps, node));
    
    Array.from(node.childNodes).forEach(child => {

        if (child.nodeType === 3) {

            parseTextNode(child, steps); 
        
        } else {

            const childSteps = getSteps(child);

            steps.push(state => {

                state.el.appendChild(render(childSteps, state.vm, state.ctx));

                return state;

            });

        }

    });

    return steps;

}

function isVmEligible(data) {

    return !(!data || typeof data !== 'object' || data._uav || data.tagName);

}

function model(data) {

    if (!isVmEligible(data)) {

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

            if (currentBinding && vm._uav) {

                let binding = currentBinding;

                // binding.el = currentNode;

                vm._uav[key] = vm._uav[key] || [];

                vm._uav[key].push(binding);

                currentNode._uav.push(() => {

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

function component(template) {

    const node = template.tagName ? template : parse(template);

    const steps = getSteps(node);

    return (vm, selector) => {

        vm = model(vm);

        const el = render(steps, vm);

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

}

uav.parse = parse;
uav.component = component;
