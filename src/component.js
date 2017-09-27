import parseHtml from './parse/html';
import parseElement from './parse/element';
import model from './model';
import util from './util';
import uav from './uav';

export default html => {

    const node = html.tagName ? html : parseHtml(html);

    const steps = parseElement(node);

    return function(vm, parent) {

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

        for (let i = 1; i < arguments.length; i++) {
        
            if (typeof arguments[i] === 'function') {

                setTimeout(() => arguments[i](vm._el));

                break;

            }

        }

        return vm;

    };

};
