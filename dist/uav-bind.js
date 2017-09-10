(function () {

    var uav = window.uav;

    if (!uav) {

        return console.error('Include uav.js before uav-bind.js');
    }

    /*
     * listenForInput creates a listener for the given event,
     * which updates the model to reflect the node's value.
     *
     * @param {Element} node - the node to bind
     * @param {String} tmpl - the template expression
     * @param {Object} vm - the view model
     * @param {String} event - the type of event on which to update the model
     *
     * @return {undefined}
     */
    function listenForInput(node, tmpl, vm, event) {

        node.addEventListener(event, function () {

            uav.evaluate(tmpl, vm);

            uav.lastAccessed.vm[uav.lastAccessed.key] = node.value;

            uav.lastAccessed = null;
        });
    }

    /*
     * Bind a radio input to a template expression.
     *
     * @param {Element} node - the node to bind
     * @param {String} tmpl - the template expression
     * @param {Object} vm - the view model
     *
     * @return {Function} - a callback that handles new values.
     */
    function bindRadio(node, tmpl, vm) {

        listenForInput(node, tmpl, vm, 'change');

        return function (value) {

            if (value === node.value) {

                node.setAttribute('checked', '');
            } else {

                node.removeAttribute('checked');
            }
        };
    }

    /*
     * Bind a checkbox input to an array.
     *
     * @param {Element} node - the node to bind
     * @param {String} tmpl - the template expression
     * @param {Object} vm - the view model
     *
     * @return {Function} - a callback that handles new values.
     */
    function bindCheckbox(node, tmpl, vm) {

        node.addEventListener('change', function () {

            uav.evaluate(tmpl, vm);

            var list = uav.lastAccessed.vm[uav.lastAccessed.key];

            uav.lastAccessed = null;

            var index = list.indexOf(node.value);

            var notInList = index === -1;

            if (node.checked && notInList) {

                list.push(node.value);
            } else if (!node.checked && !notInList) {

                list.splice(index, 1);
            }
        });

        return function (list) {

            var inputs = node.parentNode.querySelectorAll('input[name="' + node.getAttribute('name') + '"]');

            Array.from(inputs).forEach(function (input) {

                if (list.indexOf(input.value) === -1) {

                    input.removeAttribute('checked');
                } else {

                    input.setAttribute('checked', '');
                }
            });
        };
    }

    /*
     * Bind any other input to a template expression.
     *
     * @param {Element} node - the node to bind
     * @param {String} tmpl - the template expression
     * @param {Object} vm - the view model
     *
     * @return {Function} - a callback that handles new values.
     */
    function bindInput(node, tmpl, vm) {

        listenForInput(node, tmpl, vm, 'input');

        return function (value) {

            node.value = value;
        };
    }

    /*
     * Add an attribute handler that acts on the 'uav-bind' attribute.
     *
     * @param {Element} node - the node to bind
     * @param {Object} attribute - has name and value properties describing the attribute
     * @param {Object} vm - the view model
     *
     * @return {Object} - binding options
     */
    uav.attributes.push(function (node, attribute, vm) {

        if (attribute.name === 'uav-bind') {

            var replace = void 0;

            var tmpl = uav.stripTags(attribute.value);

            node.removeAttribute('uav-bind');

            switch (node.getAttribute('type')) {

                case 'radio':
                    replace = bindRadio(node, tmpl, vm);
                    break;

                case 'checkbox':
                    replace = bindCheckbox(node, tmpl, vm);
                    break;

                default:
                    replace = bindInput(node, tmpl, vm);

            }

            return {
                tmpl: tmpl,
                one: true,
                replace: replace
            };
        }
    });
})();
