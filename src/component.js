import uav from './uav';
import parseHtml from './parse/html';
import model from './model';
import parseElement from './parse/element';

function component(html, vm, parent) {

    const node = parseHtml(html.outerHTML || html);

    if (!vm) {

        return node;

    }

    vm = model(vm);

    const render = parseElement(node);

    vm.proxy._el = render(vm);

    if (parent) {

        if (typeof parent === 'string') {

            parent = uav(parent);

        }

        if (parent.tagName) {

            // uav.unbind(parent.firstElementChild);

            parent.innerHTML = '';

            parent.appendChild(vm.proxy._el);

        }

    }

    for (let i = 1; i < arguments.length; i++) {
    
        if (typeof arguments[i] === 'function') {

            setTimeout(() => arguments[i](vm.proxy._el));

            break;

        }

    }

    return vm.proxy;

}

export default component;
