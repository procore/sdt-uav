import util from './util';
import uav from './uav';

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

        const bindings = list._uav[0];

        Array.prototype.fill.apply(list, [value, start, end]);

        for (let i = list.length; i < end; i++) {

            list._watch(value, i);

            list._loops.forEach(loop => loop.add(value, i));

            list._uav[i] = bindings;

        }

        runBindings();

        delete uav._pause;

        return list;

    });

    util.defineProp(list, 'push', (...args) => {

        const startIndex = list.length;

        const bindings = list._uav[0];

        Array.prototype.push.apply(list, args);

        for (let i = startIndex; i < startIndex + args.length; i++) {

            list._watch(list[i], i);

            list._loops.forEach(loop => loop.add(list[i], i));

            list._uav[i] = bindings;

        }

        runBindings();

        return list;

    });

    util.defineProp(list, 'pop', () => {

        const lastIndex = list.length - 1;

        list._loops.forEach(loop => loop.remove(lastIndex));

        const result = Array.prototype.pop.call(list);

        delete list._uav[lastIndex];

        runBindings();

        return result;

    });

    util.defineProp(list, 'reverse', () => {

        uav._pause = true;

        const result = Array.prototype.reverse.call(list);
        
        runBindings();

        delete uav._pause;

        return result;

    });

    util.defineProp(list, 'shift', () => {

        list._loops.forEach(loop => loop.remove(0));

        const result = Array.prototype.shift.call(list);

        delete list._uav[0];

        runBindings();

        return result;

    });

    util.defineProp(list, 'sort', compare => {

        uav._pause = true;

        const result = Array.prototype.sort.call(list, compare);
        
        runBindings();

        delete uav._pause;

        return result;

    });

    util.defineProp(list, 'splice', (...args) => {

        uav._pause = true;

        const originalLength = list.length;

        const bindings = list._uav[0];

        const result = Array.prototype.splice.apply(list, [args.shift(), args.shift()].concat(args));

        for (let i = originalLength; i < list.length; i++) {

            list._watch(list[i], i);

            list._loops.forEach(loop => loop.add(list[i], i));

            list._uav[i] = bindings;

        }

        for (let i = list.length; i < originalLength; i++) {

            list._loops.forEach(loop => loop.remove(i));

            delete list._uav[i];

        }

        runBindings();

        delete uav._pause;

        return result;

    });

    util.defineProp(list, 'unshift', (...args) => {

        const originalLength = list.length;

        const bindings = list._uav[0];

        Array.prototype.unshift.apply(list, args);

        for (let i = originalLength; i < list.length; i++) {

            list._watch(list[i], i);

            list._loops.forEach(loop => loop.add(list[i], i));

            list._uav[i] = bindings;

        }

        runBindings();

        return list;

    });

};
