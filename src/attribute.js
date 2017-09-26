import uav from './uav';
import util from './util';
import loop from './loop';
import parse from './parse';

function bindAttribute(attribute, expressions, steps) {

    const codes = expressions.map(util.stripTags);

    const evaluators = codes.map(parse.expression);

    const template = attribute.value;

    const binding = el => (vm, state) => {

        let result = template;

        for (let i = 0; i < evaluators.length; i++) {

            let value = evaluators[i](vm, state.ctx);

            if (typeof value === 'function') {

                el[attribute.name] = value;

                return;

            } else if (typeof value === 'boolean') {

                value = value ? codes[i] : '';

            }

            result = result.replace(expressions[i], value);

        }

        el.setAttribute(attribute.name, result);

    };

    steps.push(state => {

        return util.bindStep(binding(state.el), state);

    });

}

function parseAttribute(attribute, steps, node) {

    if (attribute.name === 'uav-loop') {

        loop(attribute, steps, node);

    } else {

        const expressions = attribute.value.match(uav.expRX);

        if (expressions) {

            bindAttribute(attribute, expressions, steps);

        } else {

            steps.push(state => {

                state.el.setAttribute(attribute.name, attribute.value);

                return state;

            });

        }

    }

}

export default {
    parse: parseAttribute
};
