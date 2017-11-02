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

        for (let i = 0; i < end; i++) {

            list._watch(value, i);

            list._loops.forEach(loop => loop.replace(value, i));

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

        runMethod(list, 'reverse');
        
        runBindings();

        return list;

    });

    util.defineProp(list, 'shift', () => {

        uav._pause = true;

        const result = runMethod(list, 'shift');

        list._loops.forEach(loop => {

            if (loop.hasIndex) {

                list.forEach(loop.replace);

                loop.remove(list.length);

            } else {

                loop.remove(0);

            }

        });

        runBindings();

        delete uav._pause;

        return result;

    });

    util.defineProp(list, 'sort', compare => {

        const result = runMethod(list, 'sort', [compare]);

        runBindings();

        return result;

    });

    util.defineProp(list, 'splice', (...args) => {

        uav._pause = true;

        const index = args[0];

        const deleteCount = args[1] || 0;

        const originalLength = list.length;

        const result = runMethod(list, 'splice', args);

        list._loops.forEach(loop => {

            if (loop.hasIndex) {

                list.forEach(loop.replace);

                for (let i = originalLength; i > list.length; i--) {

                    loop.remove(i - 1);

                }

            } else {

                for (let i = 0; i < deleteCount; i++) {

                    loop.remove(index);

                }

                for (let i = 2; i < args.length; i++) {

                    loop.insert(args[i], index + i - 2);

                }

            }

        });

        list.forEach(list._watch);

        runBindings();

        delete uav._pause;

        return result;

    });

    util.defineProp(list, 'unshift', (...args) => {

        uav._pause = true;

        runMethod(list, 'unshift', args);

        list._loops.forEach(loop => {

            if (loop.hasIndex) {

                list.forEach(loop.replace);

            } else {

                args.forEach((arg, j) => {

                    loop.insert(arg, j);

                });

            }

        });

        list.forEach(list._watch);

        runBindings();

        delete uav._pause;

        return list;

    });

};
