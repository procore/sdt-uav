import util from './util';

/**
 * Wrap all array methods that modify the length
 * of the array, so that the appropriate cleanup
 * or binding is triggered.
 * 
 * @param  {Array} list - the array to modify
 * @return {undefined}
 */
export default list => {

    util.defineProp(list, 'push', (...args) => {

        const startIndex = list.length;

        args.forEach(arg => list._watch(arg, list.length));

        list._loops.forEach(loop => {

            args.forEach((arg, i) => {

                loop.append(arg, startIndex + i);

            });

        });

        return list;

    });

    util.defineProp(list, 'pop', () => {

        list._loops.forEach(loop => loop.remove(list.length - 1));

        return Array.prototype.pop.call(list);

    });

    util.defineProp(list, 'shift', () => {

        list._loops.forEach(loop => loop.remove(0));

        return Array.prototype.shift.call(list);

    });

    util.defineProp(list, 'splice', (...args) => {

        const originalLength = list.length;

        const start = args.shift();

        const deleteCount = args.shift();

        const result = Array.prototype.splice.apply(list, [start, deleteCount].concat(args));

        for (let i = originalLength; i < list.length; i++) {

            list._watch(list[i], i);

            list._loops.forEach(loop => loop.append(list[i], i));

        }

        for (let i = list.length; i < originalLength; i++) {

            list._loops.forEach(loop => loop.remove(i));

        }

        return result;

    });

    util.defineProp(list, 'unshift', (...args) => {

        const originalLength = list.length;

        Array.prototype.unshift.apply(list, args);

        for (let i = originalLength; i < list.length; i++) {

            list._watch(list[i], i);

            list._loops.forEach(loop => loop.append(list[i], i));

        }

        return list;

    });

};
