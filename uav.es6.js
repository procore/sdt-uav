(() => {

    /*
     * Array.prototype.from shim for IE
     */
    if (!Array.from) {

        Array.from = function (object) {

            return [].slice.call(object);

        };

    }

    /**
     * Returns the first matched DOM node or executes
     * a callback on all matched DOM nodes
     */
    const uav = window.uav = (selector, fnOrIndex) => {

        if (fnOrIndex !== undefined) {

            const els = Array.from(document.querySelectorAll(selector));

            if (typeof fnOrIndex === 'function') {

                els.forEach(fnOrIndex);

            } else if (typeof fnOrIndex === 'number') {

                return els[fnOrIndex];

            }

        } else {

            return document.querySelector(selector);

        }

    };

    /**
     * Turns an HTML string into an element
     */
    function parse(markup) {

        let el = document.createElement('div');

        el.innerHTML = markup;

        if (el.children.length > 1) {

            console.error('Components must have only one root node.');

        }

        el = el.firstElementChild;

        return el;

    }

    /**
     * Tests whether a value has properties that should be bound
     */
    function isVmEligible(value) {

        return value && typeof value === 'object' && !value.tagName;

    }

    /**
     * Returns an object that will execute
     * bindings when its properties are set
     */
    uav.model = (data, parent) => {

        const vm = Array.isArray(data) ? [] : {};

        vm._parent = parent;

        vm._bindings = {};

        /* Garbage collection callbacks */
        vm._gc = [];

        Object.keys(data).forEach(key => {

            vm[key] = data[key];

            if (isVmEligible(data[key]) && !data[key]._gc) {

                data[key] = uav.model(data[key], vm);

            }

            function get() {

                const binding = vm._binding;

                /**
                 * If a property is accessed during expression
                 * evaluation, that means it should be bound.
                 */
                if (binding) {

                    vm._bindings[key] = vm._bindings[key] || [];

                    vm._bindings[key].push(binding);

                    /**
                     * If this binding isn't for a property of this vm,
                     * Save a reference so that we can remove
                     * the binding if the other vm is overwritten.
                     */
                    if (binding._vm !== vm) {

                        binding._vm._gc.push(() => {

                            const index = vm._bindings[key].indexOf(binding);

                            vm._bindings[key].splice(index, 1);

                        });

                    }

                }

                return data[key];

            }

            function set(value) {

                if (data[key] !== value || typeof value === 'object') {

                    if (isVmEligible(value) && !value._gc) {

                        value = uav.model(value, vm);

                    }

                    /**
                     * If we're overwriting a child vm,
                     * run any garbage collection callbacks
                     * that we registered for it.
                     */
                    if (data[key] && data[key]._gc) {

                        data[key]._gc.forEach(fn => fn());

                        delete data[key];

                    }

                    data[key] = value;

                    if (vm._bindings[key]) {

                        vm._bindings[key].forEach(fn => fn());

                    }

                }

            }

            Object.defineProperty(vm, key, {
                get,
                set
            });

        });

        return vm;

    };

    /**
     * Runs the given expression using an
     * object as the scope. Unlike eval(),
     * this does NOT evaluate the expression
     * with the privileges or scope of the
     * surrounding execution context.
     */
    function evaluate(expression, scope) {

        try {

            return new Function(`with(arguments[0]){return ${expression};}`)(scope);

        } catch (err) {

            return '_invalidExpression';

        }

    }

    /**
     * Parses a template and creates bindings
     * to all values it references
     */
    function bind(opts) {

        const matches = opts.noTag ? [opts.key] : opts.key.match(/{.*?}/g);

        if (matches) {

            function binding() {

                let value,
                    content = opts.key;

                matches.forEach(match => {

                    const prop = opts.noTag ? match : match.substring(1, match.length - 1);

                    const parentBinding = opts.vm._binding;

                    if (!binding.bound) {

                        opts.vm._binding = binding;

                    }

                    value = evaluate(prop, opts.vm);

                    opts.vm._binding = parentBinding;

                    const type = typeof value;

                    if (type === 'boolean') {

                        content = content.replace(match, value ? prop : '');
                    
                    } else if (type === 'function') {

                        content = value;

                    } else if (value === undefined || value === '_invalidExpression' || value === null) {

                        content = content.replace(match, '');

                    } else if (type === 'object') {

                        if (value._element) {

                            content = value._element;

                        } else {

                            content = value;

                        }

                    } else {

                        content = content.replace(match, value.toString());

                    }

                });

                opts.replace(content);

            }

            binding._vm = opts.vm;

            binding();

            binding.bound = true;

        }

    }

    /**
     * Helper for looping over element attributes.
     */
    function forEachAttribute(el, callback) {

        const attributes = Array.from(el.attributes).filter(attribute => {

            return attribute.specified && attribute.name !== 'as';

        }).map(attribute => {

            return {
                name: attribute.name,
                value: attribute.value
            };

        });

        attributes.forEach(attribute => {

            callback(attribute);
            
        });

        if (el.value) {

            callback({
                name: 'value',
                value: el.value
            });

        }

    }

    /*
     * Bind the given attribute to the given vm
     */
    function bindAttribute(el, attribute, vm) {

        if (attribute.name === 'style' || attribute.name === 'data-style') {

            bind({
                key: attribute.value,
                vm,
                replace: style => {
                    /*
                     * IE doesn't support setAttribute for styles
                     */
                    el.style.cssText = style;

                }
            });

            el.removeAttribute('data-style');

        } else if (attribute.name === 'data-src') {

            bind({
                key: attribute.value,
                vm,
                replace: src => {

                    el.setAttribute('src', src);

                }
            });

            el.removeAttribute('data-src');

        } else {

            bind({
                key: attribute.value,
                vm,
                replace: value => {
                    /*
                     * Assume function values are event handlers
                     */
                    if (typeof value === 'function') {

                        el.removeAttribute(attribute.name);

                        el[attribute.name] = value;

                    } else {

                        el.setAttribute(attribute.name, value);

                    }

                }
            });

        }

    }

    /**
     * Checks all elements and attributes for template expressions
     */
    function render(el, vm) {

        let isLoop;

        forEachAttribute(el, attribute => {

            if (attribute.name === 'loop' && el.attributes.as) {

                const key = attribute.value,
                    prop = el.attributes.as.value;

                el.removeAttribute('loop');
                el.removeAttribute('as');

                isLoop = true;

                const template = parse(el.innerHTML);

                function replace(list) {

                    el.innerHTML = '';

                    list.forEach((value, index) => {

                        const child = template.cloneNode();

                        child.innerHTML = template.innerHTML;

                        el.appendChild(child);

                        function binding() {

                            const parentBinding = vm._binding;

                            if (!binding.bound) {

                                list._binding = binding;

                                vm._binding = binding;

                            }

                            const val = list[index];

                            delete list._binding;

                            const newChild = template.cloneNode();

                            newChild.innerHTML = template.innerHTML;

                            list[prop] = val;

                            render(newChild, list);

                            vm._binding = parentBinding;

                            delete list[prop];

                            el.replaceChild(newChild, el.children[index]);

                        }

                        binding._vm = list;

                        binding();

                        binding.bound = true;

                    });

                }

                bind({
                    key,
                    vm,
                    replace,
                    noTag: true
                });

            } else {

                bindAttribute(el, attribute, vm);

            }

        });

        if (isLoop) {

            return el;

        }

        Array.from(el.childNodes).forEach(child => {
            /*
             * Text nodes
             */
            if (child.nodeType === 3) {

                bind({
                    key: child.textContent,
                    vm,
                    replace: value => {

                        if (value.tagName || value._element) {

                            child.parentNode.replaceChild(value._element ? value._element : value, child);

                            child = value;

                        } else {

                            /**
                             * IE10 won't let you set textContent to an empty string.
                             */
                            try {

                                child.textContent = value;

                            } catch (e) {

                                child.innerHTML = '';
                            }

                        }

                    }
                });
            /*
             * Element nodes
             */
            } else {

                const tag = child.tagName.toLowerCase();
                /*
                 * Child components
                 */
                if (vm[tag] !== undefined && vm[tag]._element) {

                    bind({
                        key: tag,
                        vm,
                        replace: newChild => {

                            if (child.parentNode === el) {

                                el.replaceChild(newChild, child);

                                child = newChild;

                            }

                        },
                        noTag: true
                    });

                } else {

                    render(child, vm);

                }

            }

        });

        return el;

    }

    /**
     * Creates a bound component, optionally
     * inserting it into a parent node
     */
    uav.component = function(vm, template, selector) {

        if (typeof vm === 'string') {

            vm = {
                _element: parse(vm)
            };

            selector = template;

        } else {

            if (!vm._gc) {

                vm = uav.model(vm);

            }

            vm._element = render(parse(template), vm);

        }

        if (typeof selector === 'string') {

            const app = document.querySelector(selector);

            app.innerHTML = '';

            app.appendChild(vm._element);

        }

        Array.from(arguments).forEach(arg => {
            
            if (typeof arg === 'function') {

                arg(vm._element);

            }

        });

        return vm;

    };

    /**
     * Returns a placeholder component, for cases
     * where a template is bound to a component that
     * does not yet exist.
     */
    uav.placeholder = tag => {

        return {
            _element: document.createElement(tag || 'div')
        };

    };

    if (typeof module !== 'undefined' && module.exports) {

        module.exports = uav;

    }

})();
