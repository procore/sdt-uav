import uav from './uav';

const handler = {

    get(target, name) {

        if (name === Symbol.unscopables) {

            return [];

        }

        if (uav.binding) {

            target._uav = target._uav || {};

            target._uav[name] = target._uav[name] || [];

            target._uav[name].push(uav.binding);

        }
        console.log('get', name);
        return target[name];

    },

    set(target, name, value) {

        const bindings = target[name] && target[name]._uav;

        if (target[name] && target[name].proxy) {

            target[name].revoke();

        }

        target[name] = model(value);

        target[name]._uav = bindings;

        if (target._uav && target._uav[name]) {

            target._uav[name].forEach(fn => fn());

        }

        console.log('set', name);

        return target[name];

    }
};

function model(vm) {

    if (Object.getPrototypeOf(vm) !== Object.prototype && !Array.isArray(vm)) {

        return vm;

    }

    Object.keys(vm).forEach(key => {

        vm[key] = model(vm[key]);

    });

    return Proxy.revocable(vm, handler);

}

export default model;
