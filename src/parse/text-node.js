import uav from '../uav';
import bindTextNode from '../bind/text-node';

function parseTextNode(node) {

    const texts = node.textContent.split(uav.expRX);

    const renderers = [];

    if (texts.length > 1) {

        texts.forEach(text => {

            if (text.trim()) {

                if (text.match(uav.expRX)) {

                    renderers.push(bindTextNode(text.replace(uav.tagRX, '')));

                } else {

                    renderers.push((vm, el) => {

                        el.appendChild(document.createTextNode(text));

                    });

                }

            }

        });

    } else {

        const text = node.textContent;

        renderers.push((vm, el) => {

            el.appendChild(document.createTextNode(text));

        });

    }

    return renderers;

}

export default parseTextNode;
