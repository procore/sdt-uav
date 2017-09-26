import parse from './parse';
import util from './util';
import uav from './uav';
import element from './element';
import model from './model';

export default (attribute, steps, node) => {

    const evaluate = parse.expression(attribute.value);

    const loopVars = node.getAttribute('uav-as').split(',');

    const as = loopVars[0];

    const index = loopVars[1];

    node.removeAttribute('uav-loop');

    node.removeAttribute('uav-as');

    const childSteps = element.parse(node.firstElementChild);

    node.innerHTML = '';

    const binding = el => (vm, state) => {

        const loop = {
            
            append(item, i) {

                const child = util.render(childSteps, vm, {
                    [as]: item,
                    [index]: i
                });

                el.appendChild(child);

            },

            replace(item, i) {

                const childAtIndex = el.children[i];

                const child = util.render(childSteps, vm, {
                    [as]: item,
                    [index]: i
                });

                if (childAtIndex) {

                    util.unbind(childAtIndex);

                    el.replaceChild(child, childAtIndex);

                } else {

                    el.appendChild(child);

                }

            }

        };

        el.innerHTML = '';

        const list = model(evaluate(vm, state.ctx) || []);

        list._loops.push(loop);

        uav.binding = null;

        list.forEach(loop.append);

    };

    steps.push(state => {

        uav.binding = binding(state.el);

        uav.binding.ctx = state.ctx;

        uav.binding(state.vm, state);

        return state;

    });

};
