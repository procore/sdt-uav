(function () {
'use strict';

function all(selector, callback) {

    const els = Array.from(document.querySelectorAll(selector));

    if (callback) {

        return els.forEach(callback);

    }

    return els;

}

function uav(selector, callback) {

    if (callback) {

        return all(selector, callback);

    }

    return document.querySelector(selector) || document.createElement('div');

}

uav.all = all;

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

    bindStep(binding, state) {

        state.binding = binding;

        uav.state = state;

        binding(state);

        uav.state = null;

        return state;

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

        return !(!data || typeof data !== 'object' || data._uav || data._loops || data.tagName);

    },

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

var parseExpression = expression => {

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

};

var loop = (attribute, steps, node) => {

    const evaluate = parseExpression(attribute.value);

    const loopVars = node.getAttribute('u-as').split(',');

    const as = loopVars[0];

    const index = loopVars[1];

    node.removeAttribute('u-loop');

    node.removeAttribute('u-as');

    const childSteps = parseElement(node.firstElementChild);

    node.innerHTML = '';

    const binding = el => state => {

        const loop = {
            
            append(item, i) {

                const child = util.render(childSteps, state.vm, {
                    [as]: item,
                    [index]: i
                });

                el.appendChild(child);

            },

            replace(item, i) {

                const childAtIndex = el.children[i];

                const child = util.render(childSteps, state.vm, {
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

        case 'u-loop':

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

var component = html => {

    const node = html.tagName ? html : parseHtml(html);

    const steps = parseElement(node);

    return function(vm, parent) {

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
