import uav from '../uav';
import util from '../util';
import parseExpression from './expression';

/**
 * Bind a text node to an expression.
 * 
 * @param  {Array} steps       - rendering instructions
 * @param  {String} expression - the template expression
 * @return {undefined}
 */
function bindTextNode(steps, expression) {
    
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

            util.unbind(node);
            
            node.textContent = value;

        }

    };

    steps.push(state => {

        const node = document.createTextNode('');

        state.el.appendChild(node);

        return util.bindStep(binding(node), state);

    });

}

/**
 * Parse and bind a text node. Because
 * an expression can contain a child component
 * or an HTML element, we need to create an individual
 * text node for each expression.
 * 
 * @param  {Element} node - the text node
 * @param  {Array} steps  - rendering instructions
 * @return {undefined}
 */
function parseTextNode(node, steps) {

    const parts = node.textContent.split(uav.expRX);

    if (parts.length > 1) {

        parts.forEach(part => {

            if (part.trim()) {

                const newNode = document.createTextNode(part);

                if (part.match(uav.expRX)) {

                    bindTextNode(steps, util.stripTags(part));

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
