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
function isVmEligible(data) {

    try {

        return data && (Object.getPrototypeOf(data) === Object.prototype || Array.isArray(data));

    } catch (e) {

        return;

    }

}

/**
 * Run any bindings for the given model property.
 * 
 * @param  {Object} bindings - a map of keys to arrays of bindings
 * @param  {String} key      - a model property
 * @return {undefined}
 */
function runBindings(bindings, key) {

    if (bindings[key]) {

        bindings[key].forEach(state => state.binding(state));

    }

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

    if (from && from._uav && isVmEligible(to)) {

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
export default function model(data) {

    if (!isVmEligible(data) || data._uav) {

        return data;

    }

    let vm = {};

    if (Array.isArray(data)) {

        vm = [];

        /**
         * There can be two types of bindings on arrays:
         * loops, from the u-for attribute, or standard
         * content bindings, like <div>{list.join(', ')}</div>.
         *
         * These need to be managed differently, so we'll 
         * initialize a separate binding list for loops.
         */
        util.defineProp(vm, '_loops', []);

        /**
         * When it comes to standard content bindings on arrays,
         * note that a change to any index on the array must result
         * in re-evaluating each index and re-rendering the content,
         * as if the whole array had been replaced. This is not a 
         * limitation of uav, it's just the reason that using a template
         * loop to print array content is always a better idea.
         *
         * To more efficiently support this use, however, we can store
         * bindings only on the first index, and trigger those bindings 
         * when any array index is changed. This way we don't have to
         * store and manage the bindings for each index individually.
         *
         * We also need to wrap array methods like push and pop so 
         * that they will trigger these bindings.
         */
        bindArrayMethods(vm, () => runBindings(vm._uav, 0));

    }

    /**
     * vm._uav is where we'll store the bindings for each property
     * of the model. The binding tree takes the following form:
     *
     * vm._uav = {
     *     propA: [stateObj1, stateObj2],
     *     propB: [stateObj3]
     * };
     */
    util.defineProp(vm, '_uav', {});

    /**
     * Next we add getters and setters for each property
     * on the model. This process is wrapped in a closure,
     * vm._watch, so that new properties can be added and
     * given getters and setters later on.
     */
    util.defineProp(vm, '_watch', (val, key) => {

        function get() {

            /**
             * When uav.state is defined, this indicates that a
             * model is being evaluated, and we should associate
             * the current state with the property being accessed.
             *
             * In the case that the view model is an array, we only
             * want to store bindings if we're accessing the first 
             * index.
             */
            if (uav.state && (!vm._loops || key === '0')) {

                let state = uav.state;

                vm._uav[key] = vm._uav[key] || [];

                if (vm._uav[key].indexOf(state) === -1) {

                    vm._uav[key].push(state);

                }

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

                /**
                 * If the new value is already a view model,
                 * we will assume that we shouldn't replace
                 * its bindings. Otherwise, if the new value 
                 * will be replacing an existing view model,
                 * we need to copy the bindings over to the 
                 * new value.
                 */
                const alreadyVM = value && value._uav;

                value = model(value);

                if (!alreadyVM && data[key] && data[key]._uav) {

                    copyBindings(data[key], value);

                }

                /**
                 * Then we can actually store the new value on the vm.
                 */
                data[key] = value;

                /**
                 * If this model is an array, we can update any loops
                 * by replacing the children at the current index.
                 *
                 * If there are non-loop bindings to the array, remember
                 * that they are all stored on the first index, so we'll
                 * run those bindings regardless of which index is being
                 * accessed.
                 */
                if (vm._loops) {

                    /**
                     * uav._pause is used in bind-array-methods.js to prevent
                     * rapid-fire renders during methods like Array.fill(), 
                     * which would otherwise trigger these bindings once for
                     * every index of the array.
                     */
                    if (!uav._pause) {

                        vm._loops.forEach(loop => loop.replace(data[key], key));

                        runBindings(vm._uav, 0);

                    }

                /**
                 * If the model is not an array, we can simply run the
                 * bindings for this property. 
                 */
                } else {

                    runBindings(vm._uav, key);

                }

            }

        }

        data[key] = model(val);

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
