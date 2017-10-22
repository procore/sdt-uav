import util from './util';
import uav from './uav';

/**
 * Run an array method with the given arguments.
 * 
 * @param  {Array} list    - the array on which to operate
 * @param  {String} method - the name of the method to run
 * @param  {Array} args    - arguments to pass the method
 * @return {any} - the return value of the called method.
 */
function runMethod(list, method, args) {

    return Array.prototype[method].apply(list, args);

}

/**
 * Wrap all array methods that modify the array,
 * so that the appropriate cleanup or binding 
 * is triggered.
 * 
 * @param  {Array} list - the array to modify
 * @param {Function} runBindings - run any bindings to the array that aren't loops
 * @return {undefined}
 */
export default (list, runBindings) => {

    util.defineProp(list, 'fill', (value, start = 0, end = list.length) => {

        uav._pause = true;

        while (start < 0) {

            start += list.length;

        }

        while (end < 0) {

            end += list.length;

        }

        runMethod(list, 'fill', [value, start, end]);

        for (let i = list.length; i < end; i++) {

            list._watch(value, i);

            list._loops.forEach(loop => loop.add(value, i));

        }

        runBindings();

        delete uav._pause;

        return list;

    });

    util.defineProp(list, 'push', (...args) => {

        const startIndex = list.length;

        runMethod(list, 'push', args);

        for (let i = startIndex; i < startIndex + args.length; i++) {

            list._watch(list[i], i);

            list._loops.forEach(loop => loop.add(list[i], i));

        }

        runBindings();

        return list;

    });

    util.defineProp(list, 'pop', () => {

        const lastIndex = list.length - 1;

        list._loops.forEach(loop => loop.remove(lastIndex));

        const result = runMethod(list, 'pop');

        runBindings();

        return result;

    });

    util.defineProp(list, 'reverse', () => {

        uav._pause = true;

        runMethod(list, 'reverse');
        
        runBindings();

        delete uav._pause;

        return list;

    });

    util.defineProp(list, 'shift', () => {

        list._loops.forEach(loop => loop.remove(0));

        const result = runMethod(list, 'shift');

        runBindings();

        return result;

    });

    util.defineProp(list, 'sort', compare => {

        uav._pause = true;

        const result = runMethod(list, 'sort', [compare]);
        
        runBindings();

        delete uav._pause;

        return result;

    });

    util.defineProp(list, 'splice', (...args) => {

        uav._pause = true;

        const originalLength = list.length;

        const result = runMethod(list, 'splice', [args.shift(), args.shift()].concat(args));

        for (let i = originalLength; i < list.length; i++) {

            list._watch(list[i], i);

            list._loops.forEach(loop => loop.add(list[i], i));

        }

        for (let i = list.length; i < originalLength; i++) {

            list._loops.forEach(loop => loop.remove(i));

        }

        runBindings();

        delete uav._pause;

        return result;

    });

    util.defineProp(list, 'unshift', (...args) => {

        const originalLength = list.length;

        runMethod(list, 'unshift', args);

        for (let i = originalLength; i < list.length; i++) {

            list._watch(list[i], i);

            list._loops.forEach(loop => loop.add(list[i], i));

        }

        runBindings();

        return list;

    });

};
