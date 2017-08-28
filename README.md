# uav

uav aims to demonstrate that complexity is a problem in today's front end codebases. It solves the same problems as frameworks like React and Vue, but is only 2.1KB gzipped, and is easier to use.

> The goal of uav is not adoption. The goal is to show that the problems faced by modern web apps are not complex enough to justify the millions of developer hours our industry has invested complicated frameworks. 

## Hello World

```
const component = uav.component({
    message: 'Hello, world!'
}, `
    <div>
        <h1>{message}</h1>
    </div>
`, '#app');

// Renders into the #app element:
<h1>Hello, world!</h1>

// After running the following ...
component.message = 'Goodbye, world.';

// ... the HTML automatically updates:
<h1>Goodbye, world.</h1>
```

## `uav.component`

`uav.component(model, template, selector, callback)`

Arguments:
- `model` (Object): A view model. Optional.
- `template` (String): An HTML template. Must have exactly one root node.
- `selector` (String|Element): The element in which to render the component. Optional.
- `callback` (Function): A function to call after the initial render. Passed the component's top-level DOM element. Optional.

Returns the model.

Changes to existing properties on the model will trigger an optimized re-render. Only the smallest DOM change possible will occur, down to the level of updating a single element attribute or text node. This is accomplished without any DOM diffing, because uav constructs a tree of closures that know exactly what needs to be updated whenever a particular property is changed.

## Template Expressions

By default, uav expressions use `{curly}` notation. Any browser-supported JavaScript can be used in an any expression. The result of the expression should be one of the following:
- String
- Number
- Function (for event handlers)
- Boolean (for simplified class and property bindings)
- DOM element (don't render untrusted HTML in templates)
- uav component
- undefined or null (renders an empty string)

Regardless of what you are binding or where you are binding it, the syntax is always the same.

> You can change the template tag syntax with `uav.setTags()`. For example, to use `{{mustache}}` notation, call `uav.setTags('{{', '}}')` before creating any components.

### Text expressions:
```
uav.component(
    { content: 'foo' },
    `<div>This is a content expression: {content}</div>`
);
```

### Attribute expressions:
```
const component = uav.component({
    visible: true,
    className: 'component'
},
    `<div class="{className} {visible}"></div>`
);
```

> If an expression evaluates to a boolean, it will render nothing if false, or the property name if true. This makes toggling the "visible" class on the above `<div>` as easy as `component.visble = !component.visible`.

#### Boolean attributes
```
uav.component(
    { disabled: false },
    `<input type="text" {disabled}>`
);
```

### Template Loops

Add the `uav-loop` attribute to an element to repeat its content for each item in an array. Within the loop, reference the current value with `this`. Properties of the parent model are available within a loop.

You can reference the current index of the array with the special property `_index`.

```
uav.component({
    items: [ 1, 2, 'three' ]
}, `
    <ul uav-loop="items">
        <li class="item-{_index}">{this}</li>
    </ul>
`);
```

> Array methods that modify the array like `push` and `splice` will trigger a re-render of the loop.

> Curly braces are optional in the `uav-loop` attribute's value, since it is known to be an expression.

> Like a component, a loop's content must have one root node.

### Events

```
uav.component(
    { click: e => console.log(e) }, 
    `<button onclick={click}>Click me</button>`
);
```

Like any expression, you can pass data to an event handler:

```
uav.component({
    click: item => e => console.log(item),
    items: [ 'foo', 'bar', 'baz' ]
}, `
    <ul loop="items">
        <li onclick={click(this)}>This is {this}</li>
    </ul>
`)
```

## Child Components

A components can be rendered into other components.

```
const child = uav.component(`<h3>I am a child.</h3>`);

uav.component(
    { child }, `
    <div>
        <h1>This is a component with a child.</h1>
        {child}
    </div>
`);
```

This will render the following:

```
<div>
    <h1>This is a component with a child.</h1>
    <h3>I am a child.</h3>
</div>
```

### Passing Data to Children

```
const child = data => uav.component(
    { data }, 
    `<em>{data}</em>`
);

uav.component({
    child: child('This is passed from parent to child.')
}, `
    <div>
        This component passes data to its child.
        {child}
    </div>
`);
```

This will render the following:

```
<div>
    This component passes data to its child.
    <em>This is passed from parent to child.</em>
</div>
```

> uav supports swapping child components on the fly. For example, you could call `component.child = someOtherComponent` and the view will update accordingly.

### Binding HTML
To render an HTML string as a DOM element, you can use `uav.parse()`.

```
uav.component({
    html: uav.parse('<script>location="https://en.wikipedia.org/wiki/Cross-site_scripting"</script>')
}, 
    `<div>{html}</div>`
);
```

## Special Attributes

### uav-src

Imagine that an image's source is bound to a template expression:

`uav.component('<img src="{imageSource}" />');`

To prevent your browser from making a request to `/{imageSource}` before your JavaScript runs, you can use the `uav-src` attribute.

`uav.component('<img uav-src="{imageSource}" />');`

### uav-style

Internet Explorer can be extremely picky about the value of an inline `style` tag. A template expression like the following will work in any browser except IE:

`uav.component('<div style="left: {left}px"></div>');`

To support Internet Explorer, you can use the `uav-style` attribute instead:

`uav.component('<div uav-style="left: {left}px"></div>');`

## DOM Access

Elements can be accessed directly by passing a selector to the `uav` function.

Access the first matched element:

`uav('.item').classList.toggle('visible');`

Access all matched elements by passing a callback:

`uav('.item', item => item.classList.toggle('visible'));`

Access the nth matched element:

`uav('.item', 3).classList.toggle('visible');`

## `uav.model`

If you'd like to create a view model before associating it with a template, use this method.

```
const model = uav.model({ text: 'hi!' });

const component = uav.component(model, '<h1>{text}</h1>')
```

## Two way data binding

Two way binding is cool, but is only applicable to form-based interfaces, and can encourage lazy coding practices. For these reasons it is included as a separate file, `uav-bind.js`.

After including this file, any HTML input types that support the `value` property can be two-way bound using the `uav-bind` attribute. When a user changes a value, the model will automatically update to reflect it.

```
uav.component(
    { value: 'hi there' }
    `<input type="text" uav-bind="value"/>`
);
```

Because checkbox inputs describe a list of selected items, they can only be bound to arrays.

```
uav.component({
    items: [1, 2]
}, `
    <input type="checkbox" uav-bind="items" value="1" name="check">1<br>
    <input type="checkbox" uav-bind="items" value="2" name="check">2<br>
    <input type="checkbox" uav-bind="items" value="3" name="check">3<br>`
);
```

> `uav-bind.js` is 586 bytes gzipped.

## Performance Notes

### Only bind data when you have to

Avoid putting any data on the model that doesn't need to be bound to the DOM. If a particular value will never change, or changes to it don't need to update the DOM, just use a regular ES6 template variable to reference it (put a dollar sign in front of the expression).

```
const wontChange = 'hi!';

uav.component({
    willChange: 'loading...'
}, `
    <div>
        <p>${wontChange}</p>
        <p>{willChange}</p>
    </div>
`)
```

### Unbind any DOM nodes you've manually detached

When uav updates the DOM as a result of a change to a model, it automatically removes any bindings to DOM nodes that have been removed or replaced. However, if for some reason you manually remove or replace a bound DOM node, you can clean up any bindings to it with `uav.unbind(<Element>)`.

## Collapsing Whitespace

Using multiline template strings creates unnecessary whitespace in your JavaScript files. To collapse whitespace, add a step like this to your build process:

`tr -s " " < dist/bundle.js > dist/tmp && mv dist/tmp dist/bundle.js`

## Browser Compatibility

IE9+
