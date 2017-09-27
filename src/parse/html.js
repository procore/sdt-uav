export default (html, parent) => {

    const el = parent ? parent.cloneNode() : document.createElement('div');

    el.innerHTML = html;

    if (el.children.length !== 1) {

        console.error('Template must have 1 root node:', html);

    }

    return el.firstElementChild;

};
