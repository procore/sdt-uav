function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

(function () {
    'use strict';

    function all(selector, callback) {

        var els = Array.from(document.querySelectorAll(selector));

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

    var util = {

        defineProp: function defineProp(vm, prop, value) {
            return Object.defineProperty(vm, prop, {
                value: value,
                configurable: true,
                writable: true,
                enumerable: false
            });
        },

        unbind: function unbind(node) {

            if (node && node._uav) {

                Array.from(node.children).forEach(util.unbind);

                node._uav.forEach(function (fn) {
                    return fn();
                });

                node = null;
            }
        },
        setTag: function setTag(open, close) {

            uav.tagRX = new RegExp('(^' + open + '|' + close + '$)', 'g');

            uav.expRX = new RegExp('(' + open + '.*?' + close + ')', 'g');
        },


        stripTags: function stripTags(str) {
            return str.replace(uav.tagRX, '');
        },

        bindStep: function bindStep(binding, state) {

            state.binding = binding;

            uav.state = state;

            binding(state);

            uav.state = null;

            return state;
        },
        render: function render(steps, vm, ctx) {

            var firstStep = [{
                vm: vm,
                ctx: ctx,
                el: steps.root()
            }];

            return firstStep.concat(steps).reduce(function (a, b) {
                return b(a);
            }).el;
        },
        isVmEligible: function isVmEligible(data) {

            return !(!data || typeof data !== 'object' || data._uav || data.tagName);
        },
        createElement: function createElement(tag) {

            if (tag === 'svg' || tag === 'path') {

                return document.createElementNS('http://www.w3.org/2000/svg', tag);
            }

            return document.createElement(tag);
        }
    };

    var parseHtml = function parseHtml(html, parent) {

        var el = parent ? parent.cloneNode() : document.createElement('div');

        el.innerHTML = html;

        if (el.children.length !== 1) {

            console.error('Template must have 1 root node:', html);
        }

        return el.firstElementChild;
    };

    function copyBindings(from, to) {

        if (from && from._uav && to) {

            Object.keys(from).forEach(function (key) {

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

        var vm = {};

        if (Array.isArray(data)) {

            vm = [];

            util.defineProp(vm, '_loops', []);
        } else {

            util.defineProp(vm, '_uav', {});
        }

        Object.keys(data).forEach(function (key) {

            function get() {

                if (uav.state && vm._uav) {

                    var state = uav.state;

                    vm._uav[key] = vm._uav[key] || [];

                    vm._uav[key].push(state);

                    uav.node._uav.push(function () {

                        if (vm._uav[key]) {

                            var index = vm._uav[key].indexOf(state);

                            vm._uav[key].splice(index, 1);
                        }

                        state = null;
                    });
                }

                uav.lastAccessed = { vm: vm, key: key };

                return data[key];
            }

            function set(value) {

                var alreadyVM = value && value._uav;

                value = model(value);

                if (!alreadyVM && data[key] && data[key]._uav) {

                    copyBindings(data[key], value);
                }

                data[key] = value;

                if (vm._loops) {

                    vm._loops.forEach(function (loop) {
                        return loop.replace(data[key], key);
                    });
                } else if (vm._uav[key]) {

                    vm._uav[key].forEach(function (state) {
                        return state.binding(state);
                    });
                }
            }

            data[key] = model(data[key]);

            Object.defineProperty(vm, key, {
                get: get,
                set: set,
                configurable: true,
                enumerable: true
            });
        });

        return vm;
    }

    var parseExpression = function parseExpression(expression) {

        var evaluator = new Function('with(arguments[0]){with(arguments[1]){return ' + expression + '}}');

        return function (vm, ctx) {

            var result = void 0;

            try {

                result = evaluator(vm, ctx || {});
            } catch (err) {

                console.error(expression, err);

                result = '';
            }

            return result;
        };
    };

    var loop = function loop(attribute, steps, node) {

        var evaluate = parseExpression(attribute.value);

        var loopVars = node.getAttribute('u-as').split(',');

        var as = loopVars[0];

        var index = loopVars[1];

        node.removeAttribute('u-loop');

        node.removeAttribute('u-as');

        var childSteps = parseElement(node.firstElementChild);

        node.innerHTML = '';

        var binding = function binding(el) {
            return function (state) {

                var loop = {
                    append: function append(item, i) {
                        var _util$render;

                        var child = util.render(childSteps, state.vm, (_util$render = {}, _defineProperty(_util$render, as, item), _defineProperty(_util$render, index, i), _util$render));

                        el.appendChild(child);
                    },
                    replace: function replace(item, i) {
                        var _util$render2;

                        var childAtIndex = el.children[i];

                        var child = util.render(childSteps, state.vm, (_util$render2 = {}, _defineProperty(_util$render2, as, item), _defineProperty(_util$render2, index, i), _util$render2));

                        if (childAtIndex) {

                            util.unbind(childAtIndex);

                            el.replaceChild(child, childAtIndex);
                        } else {

                            el.appendChild(child);
                        }
                    }
                };

                el.innerHTML = '';

                var list = model(evaluate(state.vm, state.ctx) || []);

                list._loops.push(loop);

                uav.state = null;

                list.forEach(loop.append);
            };
        };

        steps.push(function (state) {

            state.binding = binding(state.el);

            uav.state = state;

            state.binding(state);

            return state;
        });
    };

    function bindBooleanAttribute(attribute, steps) {

        var property = void 0;

        var evaluate = parseExpression(attribute.value);

        var binding = function binding(el) {
            return function (state) {

                var value = evaluate(state.vm, state.ctx);

                if (property) {

                    el.removeAttribute(property);
                }

                if (value) {

                    el.setAttribute(value, '');

                    property = value;
                }
            };
        };

        steps.push(function (state) {

            return util.bindStep(binding(state.el), state);
        });
    }

    function bindAttribute(attribute, steps) {

        var expressions = attribute.value.match(uav.expRX);

        var codes = expressions.map(util.stripTags);

        var evaluators = codes.map(parseExpression);

        var template = attribute.value;

        var name = attribute.name.substring(2);

        var binding = function binding(el) {
            return function (state) {

                var result = template;

                for (var i = 0; i < evaluators.length; i++) {

                    var value = evaluators[i](state.vm, state.ctx);

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
        };

        steps.push(function (state) {

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

            steps.push(function (state) {

                state.el.setAttribute(attribute.name, attribute.value);

                return state;
            });
        }
    }

    function bindTextNode(_node, steps, expression) {

        var evaluate = parseExpression(expression);

        var binding = function binding(node) {
            return function (state) {

                var value = evaluate(state.vm, state.ctx);

                if (value._el || value.tagName) {

                    var newNode = value._el ? value._el : value;

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
        };

        steps.push(function (state) {

            var node = document.createTextNode('');

            state.el.appendChild(node);

            return util.bindStep(binding(node), state);
        });
    }

    function parseTextNode(node, steps) {

        var parts = node.textContent.split(uav.expRX);

        if (parts.length > 1) {

            var parent = node.parentNode;

            parts.forEach(function (part) {

                if (part.trim()) {

                    var newNode = document.createTextNode(part);

                    if (part.match(uav.expRX)) {

                        bindTextNode(newNode, steps, util.stripTags(part));
                    } else {

                        steps.push(function (state) {

                            state.el.appendChild(newNode);

                            return state;
                        });
                    }
                }
            });

            parent.removeChild(node);
        } else {

            steps.push(function (state) {

                state.el.appendChild(node.cloneNode());

                return state;
            });
        }
    }

    function parseElement(node) {

        uav.node = node;

        util.defineProp(uav.node, '_uav', []);

        var steps = [];

        steps.root = function () {
            return util.createElement(node.tagName);
        };

        for (var i = 0; i < node.attributes.length; i++) {

            parseAttribute(node.attributes[i], steps, node);
        }

        if (node.value) {

            parseAttribute({
                name: 'value',
                value: node.value
            }, steps, node);
        }

        Array.from(node.childNodes).forEach(function (child) {

            if (child.nodeType === 3) {

                parseTextNode(child, steps);
            } else {

                var childSteps = parseElement(child);

                steps.push(function (state) {

                    state.el.appendChild(util.render(childSteps, state.vm, state.ctx));

                    return state;
                });
            }
        });

        return steps;
    }

    var component = function component(html) {

        var node = html.tagName ? html : parseHtml(html);

        var steps = parseElement(node);

        return function (vm, parent) {
            var _arguments = arguments;


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

            var _loop = function _loop(i) {

                if (typeof _arguments[i] === 'function') {

                    setTimeout(function () {
                        return _arguments[i](vm._el);
                    });

                    return 'break';
                }
            };

            for (var i = 1; i < arguments.length; i++) {
                var _ret = _loop(i);

                if (_ret === 'break') break;
            }

            return vm;
        };
    };

    if (!Array.from) {

        Array.from = function (object) {

            return [].slice.call(object);
        };
    }

    util.setTag('{', '}');

    uav.component = component;
    uav.model = model;
    uav.parse = parseHtml;
    uav.setTag = util.setTag;

    window.uav = uav;
})();
