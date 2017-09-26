import parse from './parse';
import element from './element';
import model from './model';
import util from './util';
import uav from './uav';

export default template => {

    const node = template.tagName ? template : parse.html(template);

    const steps = element.parse(node);

    return (vm, selector) => {

        vm = model(vm);

        const el = util.render(steps, vm);

        if (selector) {

            if (typeof selector === 'string') {

                const parent = uav(selector);

                parent.innerHTML = '';

                parent.appendChild(el);

            } else {

                selector.appendChild(el);

            }

        } else {

            vm._el = el;

        }

        for (let i = 1; i < arguments.length; i++) {
        
            if (typeof arguments[i] === 'function') {

                setTimeout(() => arguments[i](el));

                break;

            }

        }

        return vm;

    };

};
