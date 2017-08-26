(() => {

    let currentBinding;

    let currentNode;

    const ARRAY_METHODS = ['push', 'pop', 'reverse', 'shift', 'sort', 'splice', 'unshift'];

    const create = tag => document.createElement(tag);

    function bindArrayMethod(method, vm, set) {

        Object.defineProperty(vm, method, {
            value: (...args) => {

                Array.prototype[method].apply(vm, args);

                set([...vm]);

            },
            enumerable: false
        });

    }

    function bindArrayMethods(data, set) {

        ARRAY_METHODS.forEach(method => bindArrayMethod(method, data, set));

    }

    const uav = window.uav = (selector, fnOrIndex) => {

        if (fnOrIndex !== undefined) {

            const els = Array.from(document.querySelectorAll(selector));

            if (typeof fnOrIndex === 'function') {

                els.forEach(fnOrIndex);

            } else if (typeof fnOrIndex === 'number') {

                return els[fnOrIndex];

            }

        } else {

            return document.querySelector(selector) || create('div');

        }

    };

    function parse(markup, parent) {

        const el = parent ? parent.cloneNode() : create('div');

        el.innerHTML = markup;

        if (el.children.length > 1) {

            console.error('Components must have only one root node.');

        }

        return el.firstElementChild;

    }

    function evaluate(expression, vm, globals) {

        try {

            return new Function(`with(arguments[0]){return ${expression}}`).bind(vm)(globals || vm);

        } catch (err) {

            return '_invalidExpression';

        }

    }

    function unbind(node) {

        if (node && node._gc) {

            [...node.children].forEach(unbind);

            node._gc.forEach(fn => fn());

            node._gc = [];

            node = null;

        }

    }

    function bind(opts) {

        const expressions = opts.noCurlyBraces ? [opts.template] : opts.template.match(/{.*?}/g);

        if (expressions) {

            function binding(doBind) {

                let result = opts.template;

                expressions.forEach(expression => {

                    const code = opts.noCurlyBraces ? expression : expression.substring(1, expression.length - 1);

                    if (doBind) {

                        currentBinding = binding;

                    }

                    //console.info(code);

                    const value = evaluate(code, opts.vm, opts.globals);

                    currentBinding = null;

                    const type = typeof value;

                    if (type === 'boolean') {

                        result = result.replace(expression, value ? code : '');
                    
                    } else if (type === 'function' || value instanceof Function) {

                        result = value;

                    } else if (value === undefined || value === '_invalidExpression' || value === null) {

                        result = result.replace(expression, '');

                    } else if (type === 'number' || type === 'string' || value instanceof Number || value instanceof String) {

                        result = result.replace(expression, value);

                    } else if (type === 'object' || value instanceof Object) {

                        if (value._element) {

                            result = value._element;

                        } else {

                            result = value;

                        }

                    } else {

                        result = result.replace(expression, value);

                    }

                });

                opts.replace(result);

            }

            binding(true);

            return binding;

        }

    }

    function forEachAttribute(el, callback) {

        const attributes = Array.from(el.attributes)
            .filter(attribute => attribute.specified)
            .map(attribute => {

                return {
                    name: attribute.name,
                    value: attribute.value
                };

            });

        attributes.forEach(attribute => callback(attribute));

        if (el.value) {

            callback({
                name: 'value',
                value: el.value
            });

        }

    }

    function bindLoop(node, attribute, vm, globals) {

        const loopNode = parse(node.innerHTML, node);

        bind({
            template: attribute.value,
            vm,
            globals,
            noCurlyBraces: true,
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

                        if (node.children[i]) {

                            node.replaceChild(render(child, list[i], vm), node.children[i]);

                        } else {

                            node.appendChild(render(child, list[i], vm));

                        }

                        currentBinding = null;

                    }

                    listBinding(true);

                });

            }
        });

    }

    function bindAttribute(node, attribute, vm, globals) {

        let isLoop;

        if (attribute.name === 'loop') {

            bindLoop(node, attribute, vm, globals);

            isLoop = true;

        } else if (attribute.name === 'style' || attribute.name === 'data-style') {

            bind({
                template: attribute.value,
                vm,
                globals,
                replace: style => {

                    node.style.cssText = style;

                }
            });

            node.removeAttribute('data-style');

        } else if (attribute.name === 'data-src') {

            bind({
                template: attribute.value,
                vm,
                globals,
                replace: src => {

                    node.setAttribute('src', src);

                }
            });

            node.removeAttribute('data-src');

        } else {

            bind({
                template: attribute.value,
                vm,
                globals,
                replace: value => {

                    if (typeof value === 'function') {

                        node.removeAttribute(attribute.name);

                        node[attribute.name] = value;

                    } else {

                        node.setAttribute(attribute.name, value);

                    }

                }
            });

        }

        return isLoop;

    }

    function bindTextNode(node, vm, globals) {

        bind({
            template: node.textContent,
            vm,
            globals,
            replace: value => {

                if (value.tagName || value._element) {

                    const newNode = value._element ? value._element : value;

                    if (newNode !== node) {

                        unbind(node);

                    }

                    node.parentNode.replaceChild(newNode, node);

                    node = value;

                } else {

                    try {

                        node.textContent = value;

                    } catch (e) {

                        node.innerHTML = '';
                    }

                }

            }
        });

    }

    function bindElementNode(parent, node, vm, globals) {

        const tag = node.tagName.toLowerCase();

        if (vm[tag] !== undefined && vm[tag]._element) {

            bind({
                template: tag,
                vm,
                globals,
                replace: newNode => {

                    if (node.parentNode === parent) {

                        if (newNode !== node) {

                            unbind(node);

                        }

                        node.parentNode.replaceChild(newNode, node);

                        node = newNode;

                    }

                },
                noCurlyBraces: true
            });

        } else {

            render(node, vm, globals);

        }

    }

    function render(node, vm, globals) {

        let isLoop;

        currentNode = node;

        Object.defineProperty(currentNode, '_gc', {
            value: [],
            writable: true,
            enumerable: false
        });

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

                bindTextNode(child, vm, globals); 
            
            } else {

                bindElementNode(node, child, vm, globals);

            }

        });

        return node;

    }

    function isVmEligible(data) {

        return !(!data || typeof data !== 'object' || data.tagName || data._bound);

    }

    function placeholder(tag) {

        return {
            _element: create(tag || 'div')
        };

    }

    function copyBindings(from, to) {

        if (from._bound && to) {

            Object.keys(from).forEach(key => {

                copyBindings(from[key], to[key]);

            });

            to._bound = from._bound;

            from = null;

        }

    }

    function model(data) {

        if (!isVmEligible(data)) {

            return data;

        }

        const vm = Array.isArray(data) ? [] : {};

        Object.defineProperty(vm, '_bound', {
            value: {},
            configurable: true,
            writable: true,
            enumerable: false
        });

        Object.keys(data).forEach(key => {

            function processValue(value) {

                if (isVmEligible(value)) {

                    value = model(value);

                    if (Array.isArray(value)) {

                        bindArrayMethods(value, set);

                    }

                }

                return value;

            }

            function get() {

                if (currentBinding) {

                    let binding = currentBinding;

                    vm._bound[key] = vm._bound[key] || [];

                    vm._bound[key].push(binding);

                    currentNode._gc.push(() => {

                        console.info('>>> unbinding ' + key);

                        const index = vm._bound[key].indexOf(binding);

                        vm._bound[key].splice(index, 1);

                        binding = null;

                    });

                }

                return data[key];

            }

            function set(value) {

                if (data[key] !== value || typeof value === 'object') {

                    if (isVmEligible(value)) {

                        value = processValue(value);

                        if (data[key] && data[key]._bound) {

                            copyBindings(data[key], value);

                        }

                        data[key] = value;

                    } else {

                        data[key] = value;

                    }

                    if (vm._bound[key]) {

                        console.info('executing ' + vm._bound[key].length +  ' bindings for ' + key);

                        vm._bound[key].forEach(fn => fn());

                    }

                }

            }

            data[key] = processValue(data[key]);

            Object.defineProperty(vm, key, {
                get,
                set,
                enumerable: true,
                configurable: true
            });

        });

        return vm;

    }

    function component(vm, template, selector) {

        if (typeof vm === 'string') {

            vm = {_element: parse(vm)};

            selector = template;

        } else {

            vm = model(vm);

            vm._element = render(parse(template), vm);

        }

        if (typeof selector === 'string') {

            const app = uav(selector);

            const oldComponent = app.firstChild;

            requestAnimationFrame(() => unbind(oldComponent));

            app.innerHTML = '';

            app.appendChild(vm._element);

        }

        for (let i = 0; i < arguments.length; i++) {
            
            if (typeof arguments[i] === 'function') {

                requestAnimationFrame(() => arguments[i](vm._element));

                break;

            }

        }

        return vm;

    }

    uav.placeholder = placeholder;

    uav.unbind = unbind;

    uav.model = model;

    uav.component = component;

    if (typeof module !== 'undefined' && module.exports) {

        module.exports = uav;

    }

})();
