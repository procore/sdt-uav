import util from './util';
import uav from './uav';
import bindArrayMethods from './bind-array-methods';

/**
 * Test an object for eligibility to be given
 * view model getters and setters
 * 
 * @param  {Object} data - the object to test
 * @return {Boolean}
 */
function notVmEligible(data) {

    return !data || typeof data !== 'object' || data.tagName;

}

/**
 * Recursively copy all bindings from one model
 * to another.
 * 
 * @param  {Object} from - the old object
 * @param  {Object} to   - the new object
 * @return {Object}      - the new object
 */
function copyBindings(from, to) {

    if (from && from._uav && !notVmEligible(to)) {

        Object.keys(from).forEach(key => {

            copyBindings(from[key], to[key]);

        });

        to._uav = from._uav;

        from = null;

    }

}

/**
 * Adds getters and setters to all properties
 * of an object so that view bindings will be
 * executed if the properties are modified.
 * 
 * @param  {Object|Array} data - the source for the model
 * @return {Object}            - the bound model
 */
export default function model(data, parent, parentKey) {

    if (notVmEligible(data) || data._uav) {

        return data;

    }

    let vm = {};

    if (Array.isArray(data)) {

        vm = [];

        util.defineProp(vm, '_loops', []);

        bindArrayMethods(vm, () => {

            if (parent && parent._uav[parentKey]) {

                parent._uav[parentKey].forEach(state => state.binding.isLoop || state.binding(state));

            }

        });

    }

    util.defineProp(vm, '_uav', {});

    util.defineProp(vm, '_watch', (val, key) => {

        function get() {

            if (uav.state) {

                let state = uav.state;

                vm._uav[key] = vm._uav[key] || [];

                vm._uav[key].push(state);

                /**
                 * Save a closure that will remove this binding,
                 * to be run if the node is removed or replaced.
                 */
                uav.node._uav.push(() => {

                    if (vm._uav[key]) {

                        vm._uav[key].splice(vm._uav[key].indexOf(state), 1);

                    }

                    state = null;

                });

            }

            /**
             * Saving a reference to the last accessed model
             * and property name is necessary for two-way binding.
             */
            uav.last = {vm, key};

            return data[key];

        }

        function set(value) {

            if (data[key] !== value) {

                const alreadyVM = value && value._uav;

                value = model(value, vm, key);

                if (!alreadyVM && data[key] && data[key]._uav) {

                    copyBindings(data[key], value);

                }

                data[key] = value;

                if (vm._loops) {

                    vm._loops.forEach(loop => loop.replace(data[key], key));

                }

                if (!uav._pause) {

                    if (vm._uav[key]) {

                        vm._uav[key].forEach(state => state.binding(state));

                    }

                }

            }

        }

        data[key] = model(val, vm, key);

        Object.defineProperty(vm, key, {
            get,
            set,
            configurable: true,
            enumerable: true
        });

    });

    Object.keys(data).forEach(key => vm._watch(data[key], key));

    return vm;

}
