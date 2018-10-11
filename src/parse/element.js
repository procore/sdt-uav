import parseAttribute from './attribute';
import parseTextNode from './text-node';

function parseElement(node) {

    let renderers = Array.from(node.attributes).map(attribute => {

        return parseAttribute(attribute, node);

    });

    if (node.value && node.tagName !== 'OPTION') {

        renderers.push(parseAttribute({
            name: 'value',
            value: node.value
        }, node));

    }

    Array.from(node.childNodes).forEach(child => {

        if (child.nodeType === 3) {

            renderers = renderers.concat(parseTextNode(child));
        
        } else {

            const render = parseElement(child);

            renderers.push((vm, el) => el.appendChild(render(vm)));

        }

    });

    return vm => {

        const el = node.cloneNode();

        renderers.forEach(fn => fn(vm, el));

        return el;

    };

}

export default parseElement;
