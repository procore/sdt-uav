function parseExpression(expression) {

    const evaluator = new Function(`with(arguments[0]){return ${expression}}`);

    return vm => {

        let result;

        try {

            result = evaluator(vm.proxy);

        } catch (err) {

            result = '';

            console.warn(err, expression);

        }

        return result === undefined || result === null ? '' : result;

    };

}

export default parseExpression;
