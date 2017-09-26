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

    bindStep(binding, step) {

        uav.binding = binding;

        binding.ctx = step.ctx;

        binding(step.vm, step);

        uav.binding = null;

        return step;

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

    isVmEligible(data) {

        return !(!data || typeof data !== 'object' || data._uav || data.tagName);

    }

};

export default util;
