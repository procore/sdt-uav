export default {

    expression(expression) {

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

    },

    html(html, parent) {

        const el = parent ? parent.cloneNode() : document.createElement('div');

        el.innerHTML = html;

        if (el.children.length !== 1) {

            console.error('Template must have 1 root node:', html);

        }

        return el.firstElementChild;

    }

};
