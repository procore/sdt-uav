const uav = window.uav;

describe('uav', () => {

    it('should have a uav function', () => {

        expect(uav('#app').tagName).toBe('DIV');

        expect(uav.all('#app').length).toBe(1);

        let tagName;

        uav('#app', el => {

            tagName = el.tagName;

        });

        expect(tagName).toBe('DIV');

    });

    it('should render a component given a selector', () => {

        uav.component('<div id="foo"></div>')({}, '#app');

        expect(uav('#app').firstElementChild.id).toBe('foo');

    });

    it('should render a component given a node', () => {

        uav.component('<div id="foo"></div>')({}, document.querySelector('#app'));

        expect(uav('#app').firstElementChild.id).toBe('foo');

    });

    it('should bind a message', () => {

        const component = uav.component('<div>{message}</div>')({
            message: 'foo'
        });

        expect(component._el.textContent).toBe('foo');

        component.message = 'bar';

        expect(component._el.textContent).toBe('bar');

    });

    it('should have a render callback', done => {

        uav.component('<div id="foo"></div>')({}, el => {

            expect(el.tagName).toBe('DIV');

            done();

        });

    });

    it('should have a setTag function', () => {

        uav.setTag('{{', '}}');

        const component = uav.component('<div>{{message}}</div>')({
            message: 'foo'
        });

        expect(component._el.textContent).toBe('foo');

        uav.setTag('{', '}');

    });

    it('should support string attribute expressions', () => {

        const component = uav.component('<div u-class="{klass}"></div>')({
            klass: 'foo'
        });

        expect(component._el.classList.contains('foo')).toBe(true);

        component.klass = 'bar';

        expect(component._el.classList.contains('bar')).toBe(true);

    });

    it('should support boolean attribute expressions', () => {

        const component = uav.component('<div u-class="{foo}"></div>')({
            foo: true
        });

        expect(component._el.classList.contains('foo')).toBe(true);

        component.foo = false;

        expect(component._el.classList.contains('foo')).toBe(false);

    });

    it('should support loops', () => {

        const component = uav.component(`
        <ul u-loop="list" u-as="item,index">
            <li>{index}: {item}</li>
        </ul>`)({
            list: [1, 2, 3]
        });

        const secondItem = component._el.firstElementChild.nextElementSibling;

        expect(component._el.outerHTML).toBe('<ul><li>0: 1</li><li>1: 2</li><li>2: 3</li></ul>');

        component.list[0] = 'foo';
        component.list[2] = 'bar';

        expect(component._el.outerHTML).toBe('<ul><li>0: foo</li><li>1: 2</li><li>2: bar</li></ul>');

        // Ensure the content wasn't completely re-rendered
        expect(component._el.firstElementChild.nextElementSibling).toBe(secondItem);

    });

    it('should support nested loops', () => {

        const component = uav.component(`
        <div u-loop="list" u-as="item,index">
            <div u-loop="item" u-as="it,i">
                <span>{i}:{it}</span>
            </div>
        </div>`)({
            list: [[0]]
        });

        expect(component._el.outerHTML).toBe('<div><div><span>0:0</span></div></div>');

        component.list[0][0] = 'foo';

        expect(component._el.outerHTML).toBe('<div><div><span>0:foo</span></div></div>');

    });

    it('should support events', () => {

        let event;

        const component = uav.component('<div onclick="{click}"></div>')({
            click: e => {
                event = e;
            }
        });

        component._el.click();

        expect(event.pageX).toBe(0);

    });

    it('should support passing data to events', () => {

        let event;

        const component = uav.component('<div onclick="{click(`foo`)}"></div>')({
            click: data => () => {
                event = data;
            }
        });

        component._el.click();

        expect(event).toBe('foo');

    });

    it('should support changing event handlers', () => {

        let event;

        const component = uav.component('<div onclick="{click}"></div>')({
            click: e => {
                event = e;
            }
        });

        component.click = () => {
            event = 'foo';
        };

        component._el.click();

        expect(event).toBe('foo');

    });

    it('should support child components', () => {

        const child = uav.component('<div></div>')({});

        const parent = uav.component('<div>{child}</div>')({child});

        expect(parent._el.firstElementChild.tagName).toBe('DIV');

    });

    it('should support binding html', () => {

        const component = uav.component('<div>{html}</div>')({
            html: uav.parse('<i></i>')
        });

        expect(component._el.firstElementChild.tagName).toBe('I');

    });

    it('should support boolean attributes', () => {

        const component = uav.component('<input u-attr="{disabled}"/>')({disabled: true});

        expect(component._el.getAttribute('disabled')).toBe('');

        component.disabled = false;

        expect(component._el.getAttribute('disabled')).toBe(null);

        component.disabled = 'disabled';

        expect(component._el.getAttribute('disabled')).toBe('');

    });

    it('should support array.push', () => {

        const component = uav.component(`
        <ul u-loop="list" u-as="item,index">
            <li>{index}: {item}</li>
        </ul>`)({
            list: [1]
        });

        const firstItem = component._el.firstElementChild;

        component.list.push(2);

        expect(component._el.outerHTML).toBe('<ul><li>0: 1</li><li>1: 2</li></ul>');

        expect(component._el.firstElementChild).toBe(firstItem);

        component.list[1] = 'foo';

        expect(component._el.outerHTML).toBe('<ul><li>0: 1</li><li>1: foo</li></ul>');

    });

    it('should support array.pop', () => {

        const component = uav.component(`
        <ul u-loop="list" u-as="item,index">
            <li>{index}: {item}</li>
        </ul>`)({
            list: [1, 2]
        });

        const firstItem = component._el.firstElementChild;

        const result = component.list.pop();

        expect(component._el.outerHTML).toBe('<ul><li>0: 1</li></ul>');

        expect(component._el.firstElementChild).toBe(firstItem);

        expect(result).toBe(2);

    });

    it('should support array.shift', () => {

        const component = uav.component(`
        <ul u-loop="list" u-as="item,index">
            <li>{index}: {item}</li>
        </ul>`)({
            list: [1, 2]
        });

        const result = component.list.shift();

        expect(component._el.outerHTML).toBe('<ul><li>0: 2</li></ul>');

        expect(result).toBe(1);

    });

    it('should support array.splice deletion', () => {

        const component = uav.component(`
        <ul u-loop="list" u-as="item,index">
            <li>{index}: {item}</li>
        </ul>`)({
            list: [1, 2]
        });

        const result = component.list.splice(0, 1);

        expect(component._el.outerHTML).toBe('<ul><li>0: 2</li></ul>');

        expect(result[0]).toBe(1);

    });

    it('should support array.splice addition', () => {

        const component = uav.component(`
        <ul u-loop="list" u-as="item,index">
            <li>{index}: {item}</li>
        </ul>`)({
            list: [1]
        });

        const result = component.list.splice(1, 0, 2, 3);

        expect(component._el.outerHTML).toBe('<ul><li>0: 1</li><li>1: 2</li><li>2: 3</li></ul>');

        expect(result.length).toBe(0);

        component.list[2] = 'foo';

        expect(component._el.outerHTML).toBe('<ul><li>0: 1</li><li>1: 2</li><li>2: foo</li></ul>');

    });

    it('should support array.unshift', () => {

        const component = uav.component(`
        <ul u-loop="list" u-as="item,index">
            <li>{index}: {item}</li>
        </ul>`)({
            list: [1]
        });

        component.list.unshift(0);

        expect(component._el.outerHTML).toBe('<ul><li>0: 0</li><li>1: 1</li></ul>');

        component.list[1] = 'foo';

        expect(component._el.outerHTML).toBe('<ul><li>0: 0</li><li>1: foo</li></ul>');

    });

    it('should support array.reverse', () => {

        const component = uav.component(`
        <ul u-loop="list" u-as="item,index">
            <li>{index}: {item}</li>
        </ul>`)({
            list: [1, 2]
        });

        component.list.reverse();

        expect(component._el.outerHTML).toBe('<ul><li>0: 2</li><li>1: 1</li></ul>');

    });

    it('should support array.sort', () => {

        const component = uav.component(`
        <ul u-loop="list" u-as="item,index">
            <li>{index}: {item}</li>
        </ul>`)({
            list: [1, 2]
        });

        component.list.sort((a, b) => b - a);

        expect(component._el.outerHTML).toBe('<ul><li>0: 2</li><li>1: 1</li></ul>');

    });

});
