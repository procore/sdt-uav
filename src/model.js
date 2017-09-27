import util from './util';
import uav from './uav';

function copyBindings(from, to) {

    if (from && from._uav && to) {

        Object.keys(from).forEach(key => {

            copyBindings(from[key], to[key]);

        });

        to._uav = from._uav;

        from = null;

    }

}

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

            if (uav.state && vm._uav) {

                let state = uav.state;

                vm._uav[key] = vm._uav[key] || [];

                vm._uav[key].push(state);

                uav.node._uav.push(() => {

                    if (vm._uav[key]) {

                        const index = vm._uav[key].indexOf(state);

                        vm._uav[key].splice(index, 1);

                    }

                    state = null;

                });

            }

            uav.lastAccessed = {vm, key};

            return data[key];

        }

        function set(value) {

            const alreadyVM = value && value._uav;

            value = model(value);

            if (!alreadyVM && data[key] && data[key]._uav) {

                copyBindings(data[key], value);

            }

            data[key] = value;

            if (vm._loops) {

                vm._loops.forEach(loop => loop.replace(data[key], key));

            } else if (vm._uav[key]) {

                vm._uav[key].forEach(state => state.binding(state));

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
