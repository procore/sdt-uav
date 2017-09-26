function all(selector, callback) {

    const els = Array.from(document.querySelectorAll(selector));

    if (callback) {

        return els.forEach(callback);

    }

    return els;

}

const uav = window.uav = (selector, callback) => {

    if (callback) {

        return all(selector, callback);

    }

    return document.querySelector(selector) || document.createElement('div');

};

export default uav;
