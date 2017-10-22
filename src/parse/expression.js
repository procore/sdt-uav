/**
 * Convert a template expression into a function that
 * can be called with a view model as well as a parent
 * execution context (for template loops).
 *
 * Note that this approach does not have the security
 * concerns of eval(), because the template expressions
 * do not have access to the execution context.
 * 
 * @param  {String} expression - the template expression
 * @return {Function}
 */
export default expression => {

    const evaluator = new Function(`with(arguments[0]){with(arguments[1]){return ${expression}}}`);

    return (vm, ctx) => {

        let result;

        try {

            result = evaluator(vm, ctx || {});

        } catch (err) {

            result = '';

        }

        return result === undefined || result === null ? '' : result;

    };

};
