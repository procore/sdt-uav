import util from '../util';
import parseAttribute from './attribute';
import parseTextNode from './text-node';

/**
 * Walk an element's attributes and children to check
 * for template expressions and construct a list of
 * steps for efficiently re-rendering the component.
 * 
 * @param  {Element} node - the node to walk
 * @return {Array} steps  - rendering instructions
 */
function parseElement(node) {

    const steps = [];

    steps.root = () => node.cloneNode();

    Array.from(node.attributes).forEach(attribute => {

        parseAttribute(attribute, steps, node);

    });

    if (node.value && node.tagName !== 'OPTION') {

        parseAttribute({
            name: 'value',
            value: node.value
        }, steps, node);

    }
    
    Array.from(node.childNodes).forEach(child => {

        if (child.nodeType === 3) {

            parseTextNode(child, steps); 
        
        } else {

            const childSteps = parseElement(child);

            steps.push(state => {

                state.el.appendChild(util.render(childSteps, state.vm, state.ctx));

                return state;

            });

        }

    });

    return steps;

}

export default parseElement;
