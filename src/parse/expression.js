export default expression => {

    const evaluator = new Function(`with(arguments[0]){with(arguments[1]){return ${expression}}}`);

    return (vm, ctx) => {

        let result;

        try {

            result = evaluator(vm, ctx || {});

        } catch (err) {

            console.error(expression, err);

            result = '';

        }

        return result;

    };

};
