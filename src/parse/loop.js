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

    const index = valueVars[1] ? valueVars[1].trim() : null;

    const childSteps = parseElement(node.firstElementChild);

    node.innerHTML = '';

    const binding = el => state => {

        Array.from(el.children).forEach(util.unbind);

        el.innerHTML = '';

        const list = model(evaluate(state.vm, state.ctx) || []);

        uav.state = null;

        function renderChild(item, i) {

            return util.render(childSteps, state.vm, Object.assign({}, state.ctx, {
                [as]: item,
                [index]: i
            }));

        }

        const loop = {
            
            append(item, i) {

                const child = renderChild(item, i);

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

                const child = renderChild(item, i);

                if (childAtIndex) {

                    util.unbind(childAtIndex);

                    el.replaceChild(child, childAtIndex);

                } else {

                    el.appendChild(child);

                }

            }

        };

        list._loops.push(loop);

        list.forEach(loop.append);

    };

    steps.push(state => {

        return util.bindStep(binding(state.el), state);

    });

};
