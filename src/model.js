import util from './util';
import uav from './uav';

export default function model(data) {

    if (!util.isVmEligible(data)) {

        return data;

    }

    let vm = {};

    if (Array.isArray(data)) {

        vm = [];

        util.defineProp(vm, '_loops', []);

    } else {

        util.defineProp(vm, '_uav', {});

    }

    Object.keys(data).forEach(key => {

        function get() {

            if (uav.binding && vm._uav) {

                let binding = uav.binding;

                vm._uav[key] = vm._uav[key] || [];

                vm._uav[key].push(binding);

                uav.node._uav.push(() => {

                    if (vm._uav[key]) {

                        const index = vm._uav[key].indexOf(binding);

                        vm._uav[key].splice(index, 1);

                    }

                    binding = null;

                });

            }

            uav.lastAccessed = {vm, key};

            return data[key];

        }

        function set(value) {

            data[key] = model(value);

            if (vm._loops) {

                vm._loops.forEach(loop => loop.replace(data[key], key));

            } else if (vm._uav[key]) {

                vm._uav[key].forEach(binding => binding(vm, binding));

            }

        }

        data[key] = model(data[key]);

        Object.defineProperty(vm, key, {
            get,
            set,
            configurable: true,
            enumerable: true
        });

    });

    return vm;

}
