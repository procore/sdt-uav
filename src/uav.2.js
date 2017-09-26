(() => {

    let binding;

    const createElement = tag => document.createElement(tag);
    
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

        return document.querySelector(selector) || createElement('div');

    };

    function setTag(open, close) {

        uav.tagRX = new RegExp(`(^${open}|${close}$)`, 'g');

        uav.expRX =  new RegExp(`(${open}.*?${close})`, 'g');

    }

    setTag('{', '}');

    function parse(markup, parent) {

        const el = parent ? parent.cloneNode() : createElement('div');

        el.innerHTML = markup;

        if (el.children.length !== 1) {

            console.error('Template must have 1 root node:', markup);

        }

        return el.firstElementChild;

    }

    const stripTags = str => str.replace(uav.tagRX, '');

    const defineProp = (vm, prop, value) => Object.defineProperty(vm, prop, {
        value,
        configurable: true,
        writable: true,
        enumerable: false
    });

    function model(data) {

        const vm = {};

        defineProp(vm, '_uav', {});

        Object.keys(data).forEach(key => {

            function get() {

                if (binding) {

                    vm._uav[key] = vm._uav[key] || [];

                    vm._uav[key].push(binding);

                }

                return data[key];

            }

            function set(value) {

                data[key] = value;

                if (vm._uav[key]) {

                    vm._uav[key].forEach(fn => fn());

                }

            }

            Object.defineProperty(vm, key, {
                get,
                set,
                configurable: true,
                enumerable: true
            });

        });

        return vm;

    }

    function parseExpression(expression) {

        return new Function(`with(arguments[0]){return ${expression}}`);

    }

    function bindTextNode(node, vm, expression) {

        const evaluate = parseExpression(expression);

        binding = () => {

            let value;

            try {

                value = evaluate(vm);

            } catch (err) {

                value = '';

            }

            if (value._el || value.tagName) {

                const newNode = value._el ? value._el : value;

                // if (newNode !== node) {

                //     unbind(node);

                // }

                if (node.parentNode) {

                    node.parentNode.replaceChild(newNode, node);

                    node = newNode;

                }

            } else {

                node.textContent = value;

            }

        };

        binding();

        binding = null;

    }

    function parseTextNode(node, vm) {

        const parts = node.textContent.split(uav.expRX);

        if (parts.length > 1) {

            const parent = node.parentNode;

            parts.forEach(part => {

                if (part.trim()) {

                    const newNode = document.createTextNode(part);

                    parent.insertBefore(newNode, node);

                    if (part.match(uav.expRX)) {

                        bindTextNode(newNode, vm, stripTags(part));

                    }

                }

            });

            parent.removeChild(node);

        }

    }

    function bindAttribute(attribute, vm, expressions) {

        const codes = expressions.map(stripTags);

        const evaluators = codes.map(parseExpression);

        const template = attribute.value;

        binding = () => {

            let result = template;

            evaluators.forEach((evaluate, i) => {

                let value;

                try {

                    value = evaluate(vm);

                } catch (err) {

                    value = '';

                }

                if (typeof value === 'boolean') {

                    value = value ? codes[i] : '';

                }

                result = result.replace(expressions[i], value);

            });

            attribute.value = result;

        };

        binding();

        binding = null;

    }

    function bindLoop(attribute, vm, node) {

        const evaluate = parseExpression(attribute.value);

        const as = node.getAttribute('uav-as');

        const template = parse(node.innerHTML);

        node.removeAttribute('uav-loop');

        node.removeAttribute('uav-as');

        node.innerHTML = '';

        function getRow(data) {

            

        }

        binding = () => {

            let list;

            try {

                list = evaluate(vm);

            } catch (err) {

                list = [];

            }



        };

        binding = null;

    }

    function parseAttribute(attribute, vm, node) {

        if (attribute.name === 'uav-loop') {

            bindLoop(attribute, vm, node);

        }

        const expressions = attribute.value.match(uav.expRX);

        if (expressions) {

            bindAttribute(attribute, vm, expressions);

        }

    }

    function walk(node, vm) {

        Array.from(node.attributes).forEach(attribute => parseAttribute(attribute, vm, node));

        Array.from(node.childNodes).forEach(child => {

            if (child.nodeType === 3) {

                parseTextNode(child, vm); 
            
            } else {

                walk(child, vm);

            }

        });

    }

    uav.component = (vm, template, selector) => {

        vm = model(vm);

        const node = parse(template);

        walk(node, vm);

        if (selector) {

            const parent = uav(selector);

            parent.innerHTML = '';

            parent.appendChild(node);

        }

        return vm;

    };

    uav.parse = parse;

})();
