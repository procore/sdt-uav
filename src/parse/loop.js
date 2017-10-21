import parseExpression from './expression';
import util from '../util';
import uav from '../uav';
import parseElement from './element';
import model from '../model';

/**
 * Bind the contents of an array to a template.
 * 
 * @param  {Object} attribute - {name, value}
 * @param  {Array} steps      - rendering instructions
 * @param  {Element} node     - the parent of the loop
 * @return {undefined}
 */
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

            const ctx = state.ctx ? Object.create(state.ctx) : {};

            ctx[as] = item;

            ctx[index] = i;

            return util.render(childSteps, state.vm, ctx);

        }

        const loop = {
            
            add(item, i) {

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

        list.forEach(loop.add);

    };

    steps.push(state => {

        const _binding = binding(state.el);

        _binding.isLoop = true;

        return util.bindStep(_binding, state);

    });

};
