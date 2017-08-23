(() => {

    /**
     * Any vm properties accessed while currentBinding
     * is non-null will be associated with that binding.
     */
    let currentBinding;

    /**
     * These array methods will be wrapped to trigger renders of template loops.
     */
    const ARRAY_METHODS = ['concat', 'push', 'pop', 'shift', 'sort', 'splice', 'unshift'];

    /*
     * Array.prototype.from shim for IE.
     */
    if (!Array.from) {

        Array.from = function (object) {

            return [].slice.call(object);

        };

    }

    /**
     * Returns the nth or first matched DOM node or executes
     * a callback on all matched DOM nodes.
     */
    const uav = window.uav = (selector, fnOrIndex) => {

        if (fnOrIndex !== undefined) {

            const els = Array.from(document.querySelectorAll(selector));

            if (typeof fnOrIndex === 'function') {

                els.forEach(fnOrIndex);

            } else {

                return els[fnOrIndex];

            }

        } else {

            return document.querySelector(selector) || document.createElement('div');

        }

    };

    /**
     * Turns an HTML string into an element.
     */
    function parse(markup, parent) {

        const el = parent ? parent.cloneNode() : document.createElement('div');

        el.innerHTML = markup;

        if (el.children.length > 1) {

            console.error('Components cannot have more than one root node', markup);

        }

        return el.firstElementChild;

    }

    function isVmEligible(data) {

        return data && typeof data === 'object' && !data.tagName;

    }

    /**
     * Turns an object into a vm if it is eligible.
     */
    function maybeVM(data) {

        if (isVmEligible(data) && !data._bound) {

            data = uav.model(data);

        }

        return data;

    }

    /**
     * Wraps the given method of the given array so
     * that will call the given setter after running.
     */
    function bindArrayMethod(method, data, set) {

        data[method] = (...args) => {

            Array.prototype[method].apply(data, args.map(maybeVM));

            set(data);

        };

    }

    /**
     * Wraps a predefiend list of array methods
     * on the given array so that they will 
     * call the given setter after running.
     */
    function bindArrayMethods(data, set) {

        ARRAY_METHODS.forEach(method => bindArrayMethod(method, data, set));

    }

    /**
     * Returns an object that will execute
     * bindings when its properties are changed.
     */
    uav.model = data => {

        const vm = Array.isArray(data) ? [] : {};

        /**
         * vm._bound stores references to all bindings on the vm.
         * vm._bound._gc stores garbage collection callbacks that
         * will run if this vm is overwritten.
         */
        vm._bound = {
            _gc: []
        };

        Object.keys(data).forEach(key => {

            data[key] = maybeVM(data[key]);

            function get() {

                /**
                 * If a property is accessed during expression
                 * evaluation, that means it should be bound.
                 */
                if (currentBinding) {

                    vm._bound[key] = vm._bound[key] || [];

                    vm._bound[key].push(currentBinding);

                    /**
                     * If this binding isn't for a property of this vm,
                     * Save a closure that will remove the binding if
                     * the other vm is overwritten.
                     */
                    if (currentBinding._vm._bound && currentBinding._vm !== vm) {

                        currentBinding._vm._bound._gc.push(() => {
                            console.log('garbage collection! ', key);
                            const index = vm._bound[key].indexOf(currentBinding);

                            vm._bound[key].splice(index, 1);

                        });

                    }

                }

                return data[key];

            }

            function set(value) {

                if (data[key] !== value || typeof value === 'object') {

                    const previousBindings = data[key] && data[key]._bound;

                    /**
                     * If we're overwriting a child vm,
                     * run any garbage collection callbacks
                     * that we registered for it.
                     */
                    if (previousBindings) {

                        previousBindings._gc.forEach(fn => fn());

                    }

                    value = maybeVM(value);

                    // if (Array.isArray(value)) {

                    //     bindArrayMethods(value, set);

                    // }

                    data[key] = value;

                    if (vm._bound[key]) {

                        vm._bound[key].forEach(fn => fn(fn._vm));

                    }

                }

            }

            // if (Array.isArray(data[key])) {

            //     bindArrayMethods(data[key], set);

            // }

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
    function evaluate(expression, vm, globals) {

        try {

            return new Function(`with(arguments[0]){return ${expression}}`).bind(vm)(globals || vm);

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

            function binding(vm) {

                let value,
                    content = opts.key;

                matches.forEach(match => {

                    const prop = opts.noTag ? match : match.substring(1, match.length - 1);

                    if (!binding.bound) {

                        currentBinding = binding;

                    }

                    value = evaluate(prop, vm, opts.globals);

                    currentBinding = null;

                    const type = typeof value;

                    if (type === 'boolean') {

                        content = content.replace(match, value ? prop : '');
                    
                    } else if (type === 'function') {

                        content = value;

                    } else if (value instanceof Number || value instanceof String) {

                        content = content.replace(match, value);

                    } else if (value === undefined || value === '_invalidExpression' || value === null) {

                        content = content.replace(match, '');

                    } else if (type === 'object') {

                        if (value._element) {

                            content = value._element;

                        } else {

                            content = value;

                        }

                    } else {

                        content = content.replace(match, String(value));

                    }

                });

                opts.replace(content);

            }

            binding._vm = opts.vm;

            binding(opts.vm);

            //binding.bound = true;

        }

    }

    /**
     * Helper for looping over element attributes.
     */
    function forEachAttribute(el, callback) {

        const attributes = Array.from(el.attributes)
            .filter(attribute => attribute.specified)
            .map(attribute => {

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
    function bindAttribute(el, attribute, vm, globals) {

        if (attribute.name === 'style' || attribute.name === 'data-style') {

            bind({
                key: attribute.value,
                vm,
                globals,
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
                globals,
                replace: src => {

                    el.setAttribute('src', src);

                }
            });

            el.removeAttribute('data-src');

        } else {

            bind({
                key: attribute.value,
                vm,
                globals,
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
    function render(el, vm, globals) {

        let isLoop;

        forEachAttribute(el, attribute => {

            if (attribute.name === 'loop') {

                const key = attribute.value;

                el.removeAttribute('loop');

                isLoop = true;

                const template = parse(el.innerHTML, el);

                function replace(list) {

                    el.innerHTML = '';

                    list.forEach((item, index) => {

                        const child = template.cloneNode();

                        child.innerHTML = template.innerHTML;

                        function binding() {

                            const newChild = template.cloneNode();

                            newChild.innerHTML = template.innerHTML;

                            item = list[index];

                            if (!binding.bound) {

                                currentBinding = binding;

                            }

                            /**
                             * If this item is not a vm,
                             * trigger the parent vm's getter
                             * to attach a binding
                             */
                            if (typeof item !== 'object' || item && !item._bound) {

                                list[index] = list[index];

                            }

                            render(newChild, item, vm);

                            currentBinding = null;

                            el.replaceChild(newChild, el.children[index]);

                        }

                        binding._vm = item;

                        el.appendChild(child);

                        binding();

                        //binding.bound = true;

                    });

                }

                bind({
                    key,
                    vm,
                    replace,
                    globals,
                    noTag: true
                });

            } else {

                bindAttribute(el, attribute, vm, globals);

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
                    globals,
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
                        globals,
                        replace: newChild => {

                            if (child.parentNode === el) {

                                el.replaceChild(newChild, child);

                                child = newChild;

                            }

                        },
                        noTag: true
                    });

                } else {

                    render(child, vm, globals);

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

            if (!vm._bound) {

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
