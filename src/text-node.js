import uav from './uav';
import util from './util';
import parse from './parse';

function bindTextNode(_node, steps, expression) {

    const evaluate = parse.expression(expression);

    const binding = node => (vm, state) => {

        const value = evaluate(vm, state.ctx);

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

        const parent = node.parentNode;

        parts.forEach(part => {

            if (part.trim()) {

                const newNode = document.createTextNode(part);

                if (part.match(uav.expRX)) {

                    bindTextNode(newNode, steps, util.stripTags(part));

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

export default {
    parse: parseTextNode
};
