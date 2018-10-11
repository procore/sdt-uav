import uav from '../uav';
import parseExpression from '../parse/expression';

function bindTextNode(text) {
    
    const evaluate = parseExpression(text);

    let node;

    return (vm, el) => {

        uav.binding = () => {

            const value = evaluate(vm);

            const newNode = value && (value._el || value.tagName) || document.createTextNode(value);

            if (node && node.parentNode) {

                node.parentNode.replaceChild(newNode, node);

            } else {

                el.appendChild(newNode);

            }

            node = newNode;

        };

        uav.binding();

        uav.binding = null;

    };

}

export default bindTextNode;
