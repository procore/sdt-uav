import parseExpression from './expression';
import util from '../util';
import uav from '../uav';
import parseElement from './element';
import model from '../model';

export default (attribute, steps, node) => {

    const loopVars = util.stripTags(attribute.value).split(' as ');

    const evaluate = parseExpression(loopVars[0]);

    const valueVars = loopVars[1].split(',');

    const as = valueVars[0].trim();

    const index = valueVars[1].trim();

    node.removeAttribute('u-for');

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
