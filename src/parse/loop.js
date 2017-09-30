import parseExpression from './expression';
import util from '../util';
import uav from '../uav';
import parseElement from './element';
import model from '../model';

export default (attribute, steps, node) => {

    const evaluate = parseExpression(attribute.value);

    const loopVars = node.getAttribute('u-as').split(',');

    const as = loopVars[0];

    const index = loopVars[1];

    node.removeAttribute('u-loop');

    node.removeAttribute('u-as');

    const childSteps = parseElement(node.firstElementChild);

    node.innerHTML = '';

    const binding = el => state => {

        const loop = {
            
            append(item, i) {

                const child = util.render(childSteps, state.vm, {
                    [as]: item,
                    [index]: i
                });

                el.appendChild(child);

            },

            remove(i) {

                if (el.children[i]) {

                    util.unbind(el.children[i]);

                    el.children[i].remove();

                }

            },

            replace(item, i) {

                const childAtIndex = el.children[i];

                const child = util.render(childSteps, state.vm, {
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

        const list = model(evaluate(state.vm, state.ctx) || []);

        list._loops.push(loop);

        uav.state = null;

        list.forEach(loop.append);

    };

    steps.push(state => {

        state.binding = binding(state.el);

        uav.state = state;

        state.binding(state);

        return state;

    });

};
