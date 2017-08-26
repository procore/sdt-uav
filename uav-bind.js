'use strict';

(function () {

    var uav = window.uav;

    if (!uav) {

        return console.error('Include uav.js before uav.2way.js');
    }

    function listenForInput(node, tmpl, vm, globals, event) {

        node.addEventListener(event, function () {

            uav.evaluate(tmpl, vm, globals);

            uav.lastAccessed.vm[uav.lastAccessed.key] = node.value;

            uav.lastAccessed = null;
        });
    }

    function bindRadio(node, tmpl, vm, globals) {

        listenForInput(node, tmpl, vm, globals, 'change');

        return function (value) {

            if (value === node.value) {

                node.setAttribute('checked', '');
            } else {

                node.removeAttribute('checked');
            }
        };
    }

    function bindCheckbox(node, tmpl, vm, globals) {

        node.addEventListener('change', function () {

            uav.evaluate(tmpl, vm, globals);

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

            [].concat(_toConsumableArray(inputs)).forEach(function (input) {

                if (list.indexOf(input.value) === -1) {

                    input.removeAttribute('checked');
                } else {

                    input.setAttribute('checked', '');
                }
            });
        };
    }

    function bindInput(node, tmpl, vm, globals) {

        listenForInput(node, tmpl, vm, globals, 'input');

        return function (value) {

            node.value = value;
        };
    }

    uav.attributes.push(function (node, attribute, vm, globals) {

        if (attribute.name === 'uav-bind') {

            var replace = void 0;

            var tmpl = uav.stripTags(attribute.value);

            node.removeAttribute('uav-bind');

            switch (node.getAttribute('type')) {

                case 'radio':
                    replace = bindRadio(node, tmpl, vm, globals);
                    break;

                case 'checkbox':
                    replace = bindCheckbox(node, tmpl, vm, globals);
                    break;

                default:
                    replace = bindInput(node, tmpl, vm, globals);

            }

            return {
                tmpl: tmpl,
                single: true,
                replace: replace
            };
        }
    });
})();
