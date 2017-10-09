import uav from '../uav';
import util from '../util';
import parseExpression from './expression';

function bindTextNode(_node, steps, expression) {
    
    const evaluate = parseExpression(expression);

    const binding = node => state => {

        const value = evaluate(state.vm, state.ctx);

        if (value && (value._el || value.tagName)) {

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

        const text = node.textContent;

        steps.push(state => {

            state.el.appendChild(document.createTextNode(text));

            return state;

        });

    }

}

export default parseTextNode;
