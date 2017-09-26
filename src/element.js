import uav from './uav';
import util from './util';
import attribute from './attribute';
import textNode from './text-node';

function parseElement(node) {

    uav.node = node;

    util.defineProp(uav.node, '_uav', []);

    const steps = [];

    steps.root = () => document.createElement(node.tagName, node.parentNode);

    Array.from(node.attributes).forEach(attr => attribute.parse(attr, steps, node));
    
    Array.from(node.childNodes).forEach(child => {

        if (child.nodeType === 3) {

            textNode.parse(child, steps); 
        
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

export default {
    parse: parseElement
};
