function all(selector, callback) {

    const els = Array.from(document.querySelectorAll(selector));

    if (callback) {

        els.forEach(callback);

    }

    return els;

}

function uav(selector, callback) {

    if (callback) {

        return all(selector, callback);

    }

    return document.querySelector(selector) || document.createElement('div');

}

function setTag(open, close) {

    uav.tagRX = new RegExp(`(^${open}|${close}$)`, 'g');

    uav.expRX =  new RegExp(`(${open}.*?${close})`, 'g');

}

uav.all = all;

uav.setTag = setTag;

export default uav;
