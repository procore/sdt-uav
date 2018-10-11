function parseAttribute(attribute, node) {

    if (attribute.name.indexOf('u-') === 0) {

        attribute = {
            name: attribute.name,
            value: attribute.value
        };

        node.removeAttribute(attribute.name);

        switch (attribute.name) {

        case 'u-for':

            return loop(attribute, node);

        case 'u-attr':

            return bindBooleanAttribute(attribute);

        case 'u-bind':

            return twoWayBind(attribute, node);

        }
        
        bindAttribute(attribute);

    } else {

        return el => el.setAttribute(attribute.name, attribute.value);

    }

}

export default parseAttribute;
