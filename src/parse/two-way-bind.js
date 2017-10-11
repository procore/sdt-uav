import util from '../util';
import parseExpression from './expression';
import uav from '../uav';

/**
 * Two-way bind a radio input to an expression.
 * 
 * @param  {Array} steps       - rendering instructions
 * @param  {Function} evaluate - the curried expression evaluator
 * @return {undefined}
 */
function bindRadio(steps, evaluate) {

    const binding = el => state => {

        el.checked = evaluate(state.vm, state.ctx).toString() === el.value;

    };

    steps.push(state => {

        state.el.addEventListener('change', () => {

            evaluate(state.vm, state.ctx);

            uav.lastAccessed.vm[uav.lastAccessed.key] = state.el.value;

            uav.lastAccessed = null;

        });

        util.bindStep(binding(state.el), state);

        return state;

    });

}

/**
 * Two-way bind a checkbox input to an expression.
 *
 * Individual checkboxes can be bound to booleans, or
 * groups of checkboxes can be bound to arrays.
 * 
 * @param  {Array} steps       - rendering instructions
 * @param  {Function} evaluate - the curried expression evaluator
 * @return {undefined}
 */
function bindCheckbox(steps, evaluate) {

    const binding = el => state => {

        const value = evaluate(state.vm, state.ctx);

        if (Array.isArray(value)) {

            el.checked = value.map(String).indexOf(el.value) !== -1;

        } else {

            el.checked = value ? true : false;

        }

    };

    steps.push(state => {

        state.el.addEventListener('change', () => {

            const value = evaluate(state.vm, state.ctx);

            if (Array.isArray(value)) {

                const index = value.indexOf(state.el.value);

                if (index === -1 && state.el.checked) {

                    value.push(state.el.value);

                } else if (index !== -1 && !state.el.checked) {

                    value.splice(index, 1);

                }

            } else {

                uav.lastAccessed.vm[uav.lastAccessed.key] = state.el.checked;

            }

            uav.lastAccessed = null;

            return state;

        });

        const value = evaluate(state.vm, state.ctx);

        if (Array.isArray(value)) {

            const updateCheckbox = () => binding(state.el)(state);
             
            value._loops.push({
                add: updateCheckbox,
                remove: updateCheckbox,
                replace: updateCheckbox
            });

        }

        return util.bindStep(binding(state.el), state);

    });

}

/**
 * Two-way bind an input to an expression.
 * 
 * @param  {Array} steps       - rendering instructions
 * @param  {Function} evaluate - the curried expression evaluator
 * @return {undefined}
 */
function bindInput(steps, evaluate) {

    const binding = el => state => {

        el.value = evaluate(state.vm, state.ctx);

    };

    steps.push(state => {

        state.el.addEventListener('input', () => {

            evaluate(state.vm, state.ctx);

            uav.lastAccessed.vm[uav.lastAccessed.key] = state.el.value;

            uav.lastAccessed = null;

        });

        util.bindStep(binding(state.el), state);

        return state;

    });

}

/**
 * Two-way bind an input to an expression.
 * 
 * @param  {Object} attribute - {name, value}
 * @param  {Array} steps      - rendering instructions
 * @param  {Element} node     - the input
 * @return {undefined}
 */
export default (attribute, steps, node) => {

    const evaluate = parseExpression(util.stripTags(attribute.value));

    switch (node.getAttribute('type')) {

    case 'radio':
        bindRadio(steps, evaluate);
        break;

    case 'checkbox':
        bindCheckbox(steps, evaluate);
        break;

    default:
        bindInput(steps, evaluate);

    }

};
