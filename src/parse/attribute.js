import uav from '../uav';
import util from '../util';
import parseExpression from './expression';
import loop from './loop';

function bindBooleanAttribute(attribute, steps) {

    let property;

    const evaluate = parseExpression(attribute.value);

    const binding = el => state => {

        const value = evaluate(state.vm, state.ctx);

        if (property) {

            el.removeAttribute(property);

        }

        if (value) {

            el.setAttribute(value, '');

            property = value;

        }

    };

    steps.push(state => {

        return util.bindStep(binding(state.el), state);

    });

}

function bindAttribute(attribute, steps) {

    const expressions = attribute.value.match(uav.expRX);

    const codes = expressions.map(util.stripTags);

    const evaluators = codes.map(parseExpression);

    const template = attribute.value;

    const name = attribute.name.substring(2);

    const binding = el => state => {

        let result = template;

        for (let i = 0; i < evaluators.length; i++) {

            let value = evaluators[i](state.vm, state.ctx);

            switch (typeof value) {

            case 'function':

                el[name] = value;

                return;

            case 'boolean':

                value = value ? codes[i] : '';

            }

            result = result.replace(expressions[i], value);

        }

        el.setAttribute(name, result);

    };

    steps.push(state => {

        return util.bindStep(binding(state.el), state);

    });

}

function parseAttribute(attribute, steps, node) {

    if (attribute.name.indexOf('u-') === 0) {

        switch (attribute.name) {

        case 'u-loop':

            return loop(attribute, steps, node);

        case 'u-attr':

            return bindBooleanAttribute(attribute, steps);

        }
        
        bindAttribute(attribute, steps);

    } else {

        steps.push(state => {

            state.el.setAttribute(attribute.name, attribute.value);

            return state;

        });

    }

}

export default parseAttribute;
