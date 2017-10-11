/**
 * Convert an HTML string into an HTML tree.
 * Must have one root node.
 * 
 * @param  {String} html - the string to convert
 * @param  {Element} parent - the element's parent (optional).
 * @return {Element}
 */
export default (html, parent) => {

    const el = parent ? parent.cloneNode() : document.createElement('div');

    el.innerHTML = html;

    if (el.children.length !== 1) {

        console.error('Template must have 1 root node:', html);

    }

    return el.firstElementChild;

};
