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
    function model(data) {

        const vm = Array.isArray(data) ? [] : {};

        vm._bindings = {};

        Object.keys(data).forEach(key => {

            vm[key] = data[key];

            if (isVmEligible(data[key])) {

                data[key] = model(data[key]);

            }

            function get() {

                /**
                 * If a property is accessed during expression
                 * evaluation, that means it should be bound.
                 */
                if (vm._currentlyCreatingBinding) {

                    vm._bindings[key] = vm._bindings[key] || [];

                    vm._bindings[key].push(vm._currentlyCreatingBinding);

                }

                return data[key];

            }

            function set(value) {

                if (data[key] !== value || typeof value === 'object') {

                    if (isVmEligible(value)) {

                        value = model(value);

                    }

                    data[key] = value;

                    if (vm._bindings[key]) {

                        vm._bindings[key].forEach(binding => binding());

                    }

                }

            }

            Object.defineProperty(vm, key, {
                get,
                set
            });

        });

        return vm;

    }

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
    function bind(template, vm, replace, alreadyBound) {

        const matches = template.match(/{.*?}/g);

        if (matches) {

            function binding() {

                let value,
                    content = template;

                matches.forEach(match => {

                    const prop = match.substring(1, match.length - 1);

                    if (!binding.bound && !alreadyBound) {

                        vm._currentlyCreatingBinding = binding;

                    }

                    value = evaluate(prop, vm);

                    delete vm._currentlyCreatingBinding;

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

                replace(content);

            }

            binding();

            binding.bound = true;

        }

    }

    /*
     * Copy child nodes from one element to another,
     * leaving the original nodes in place
     */
    function copyChildNodes(from, to) {

        Array.from(from.childNodes).forEach(node => to.appendChild(node.cloneNode(true)));

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
    function bindAttribute(el, attribute, vm, alreadyBound) {

        if (attribute.name === 'style' || attribute.name === 'data-style') {

            bind(attribute.value, vm, style => {
                /*
                 * IE doesn't support setAttribute for styles
                 */
                el.style.cssText = style;

            }, alreadyBound);

            el.removeAttribute('data-style');

        } else if (attribute.name === 'data-src') {

            bind(attribute.value, vm, src => {

                el.setAttribute('src', src);

            }, alreadyBound);

            el.removeAttribute('data-src');

        } else {

            bind(attribute.value, vm, value => {
                /*
                 * Assume function values are event handlers
                 */
                if (typeof value === 'function') {

                    el.removeAttribute(attribute.name);

                    el[attribute.name] = value;

                } else {

                    el.setAttribute(attribute.name, value);

                }

            }, alreadyBound);

        }

    }

    /**
     * Checks all elements and attributes for template expressions
     */
    function render(el, vm, alreadyBound) {

        forEachAttribute(el, attribute => {

            if (attribute.name === 'loop' && el.attributes.as) {

                const template = parse(el.innerHTML);

                function binding() {

                    el.innerHTML = '';

                    const loopVM = evaluate(attribute.value, vm);

                    loopVM.forEach(value => {

                        function innerBinding() {

                            const child = template.cloneNode();

                            child.innerHTML = template.innerHTML;

                            el.appendChild(child);

                            loopVM[el.attributes.as.value] = value;

                            loopVM._currentlyCreatingBinding = innerBinding;

                            render(child, loopVM);

                            delete loopVM._currentlyCreatingBinding;

                        }

                        innerBinding();

                        innerBinding.bound = true;

                    });

                    delete loopVM[el.attributes.as.value];

                }

                bind(`{${attribute.value}}`, vm, binding, alreadyBound);

                binding.bound = true;

                // function binding(data) {

                //     if (data) {

                //         const newEl = document.createElement(el.tagName);

                //         Object.keys(data).forEach((i, index) => {

                //             // const valOriginalValue = vm[val],
                //             //     keyOriginalValue = vm[i];

                //             // vm[val] = data[i];
                //             // vm[key] = i;

                //             // copyChildNodes(child, newEl);

                //             // render(Array.from(newEl.children)[index], vm, binding.bound);

                //             // vm[val] = valOriginalValue;
                //             // vm[key] = keyOriginalValue;
                            
                //             function keyBinding(value) {

                //                 copyChildNodes(child, newEl);

                //                 render(Array.from(newEl.children)[index], data, keyBinding.bound);

                //             }

                //             bind(`{${i}}`, data, keyBinding, keyBinding.bound);

                //         });

                //         el.innerHTML = '';

                //         Array.from(newEl.childNodes).forEach(node => el.appendChild(node));

                //     }

                // }

                // bind(`{${attribute.value}}`, vm, binding, alreadyBound);

                // binding.bound = true;

                // el.removeAttribute('loop');
                // el.removeAttribute('as');

            } else {

                bindAttribute(el, attribute, vm, alreadyBound);

            }

        });

        Array.from(el.childNodes).forEach(child => {
            /*
             * Text nodes
             */
            if (child.nodeType === 3) {

                bind(child.textContent, vm, value => {

                    if (value.tagName) {

                        child.parentNode.replaceChild(value, child);

                        child = value;

                    } else {

                        // Ridiculous IE10 behavior
                        // http://stackoverflow.com/questions/28741528/is-there-a-bug-in-internet-explorer-9-10-with-innerhtml
                        try {

                            child.textContent = value;
                        } catch (e) {

                            child.innerHTML = '';
                        }

                    }

                }, alreadyBound);
            /*
             * Element nodes
             */
            } else {

                const tag = child.tagName.toLowerCase();
                /*
                 * Child components
                 */
                if (vm[tag] !== undefined && vm[tag]._element) {

                    bind(`{${tag}}`, vm, newChild => {

                        if (child.parentNode === el) {

                            el.replaceChild(newChild, child);

                            child = newChild;

                        }

                    }, alreadyBound);

                } else {

                    render(child, vm, alreadyBound);

                }

            }

        });

        return el;

    }

    /**
     * Creates a bound component, optionally
     * inserting it into a parent node
     */
    function component(vm, template, selector) {

        if (typeof vm === 'string') {

            vm = {
                _element: parse(vm)
            };

            selector = template;

        } else {

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

    }

    /**
     * Returns the first matched DOM node or executes
     * a callback on all matched DOM nodes
     */
    const uav = (selector, fnOrIndex) => {

        if (fnOrIndex !== undefined) {

            const els = Array.from(document.querySelectorAll(selector));

            if (typeof fnOrIndex === 'function') {

                els.forEach(fnOrIndex);

            } else if (typeof fnOrIndex === 'number') {

                return els[fnOrIndex];

            }

        } else {

            return document.querySelector(selector) || document.createElement('div');

        }

    };

    /**
     * Returns a placeholder component, for cases
     * where a template is bound to a component that
     * does not yet exist.
     */
    function placeholder(tag) {

        return {
            _element: document.createElement(tag || 'div')
        };

    }

    uav.model = model;

    uav.component = component;

    uav.placeholder = placeholder;

    if (typeof module !== 'undefined' && module.exports) {

        module.exports = uav;

    } else {

        window.uav = uav;

    }

})();
