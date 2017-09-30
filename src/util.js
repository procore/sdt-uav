import uav from './uav';

const util = {

    defineProp: (vm, prop, value) => Object.defineProperty(vm, prop, {
        value,
        configurable: true,
        writable: true,
        enumerable: false
    }),

    unbind(node) {

        if (node && node._uav) {

            Array.from(node.children).forEach(util.unbind);

            node._uav.forEach(fn => fn());

            node = null;

        }

    },

    setTag(open, close) {

        uav.tagRX = new RegExp(`(^${open}|${close}$)`, 'g');

        uav.expRX =  new RegExp(`(${open}.*?${close})`, 'g');

    },

    stripTags: str => str.replace(uav.tagRX, ''),

    bindStep(binding, state) {

        state.binding = binding;

        uav.state = state;

        binding(state);

        uav.state = null;

        return state;

    },

    render(steps, vm, ctx) {

        const firstStep = [{
            vm,
            ctx,
            el: steps.root()
        }];

        return firstStep
            .concat(steps)
            .reduce((a, b) => b(a)).el;

    },

    createElement(tag) {

        if (tag === 'svg' || tag === 'path') {

            return document.createElementNS('http://www.w3.org/2000/svg', tag);

        }

        return document.createElement(tag);

    }

};

export default util;
