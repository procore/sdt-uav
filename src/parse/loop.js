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

    const loopVars = util.stripTags(attribute.value).split(' in ');

    const evaluate = parseExpression(loopVars[1]);

    const valueVars = loopVars[0].split(',');

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

            const child = util.render(childSteps, state.vm, ctx);

            return child;

        }

        const loop = {

            hasIndex: index,
            
            add(item, i) {

                const child = renderChild(item, i);

                el.appendChild(child);

            },

            insert(item, i) {

                const child = renderChild(item, i);

                el.insertBefore(child, el.children[i]);

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

        /**
         * Save a closure that will remove this binding,
         * to be run if the node is removed or replaced.
         */
        uav.node._uav.push(function () {

            list._loops.splice(list._loops.indexOf(loop), 1);

        });

        list.forEach(loop.add);

    };

    steps.push(state => util.bindStep(binding(state.el), state));

};
