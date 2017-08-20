# UAV

UAV is a small JavaScript utility for templates with one-way data binding. 

## Install

`npm install uav`

## Example

[See a JSFiddle](http://jsfiddle.net/t16bzg3m/7/)

### `uav.component`

`uav.component(model, template, selector, callback)`

Arguments:
- `model`: A view model. Optional.
- `template`: A template string. Must have exactly one root node.
- `selector`: A CSS selector indicating a parent element in which to render this component. Optional.
- `callback`: A function to call after the initial render. Passed the component's top-level DOM element. Optional.

Returns: The model.

```javascript
const component = uav.component({text: 'hi!'}, '<h1>{text}</h1>', '#app');
```

After creating a component, any changes to the model will trigger an optimized re-render. Only the smallest DOM change possible will occur, down to the level of updating a single element attribute or text node.

### `uav.model`

If you'd like to create a view model before associating it with a template, use this method.

```javascript
const model = uav.model({text: 'hi!'});

const component = uav.component(model, '<h1>{text}</h1>')
```

### Template Expressions

UAV expressions use `{curly}` notation. Any valid javascript can be used in an expression. The result of the expression can be a string, number, function, boolean, DOM element, UAV component, undefined, or null.

#### Basic expression:
```javascript
`<div>This is a content expression: {content}</div>`
```

#### Attribute expression:
```javascript
`<div class="wrapper {visible}"></div>`
```

If an attribute expression evaluates to a boolean, it will render nothing if false, or the property name if true. This makes toggling the "visible" class on the above `<div>` as easy as `model.visble = !model.visible`.

Event expression:
```javascript
`<div onclick="{click}"></div>`
```

Any template expression which evaluates to a function is assumed to be an event handler, and will be passed the event object.

Array loop expression:
```javascript
`<ul loop="items" as="item">
    <li>{item}</li>
</ul>`
```

Add the `loop` and `as` attributes to an element to repeat its content for each item in an array.

## Child Components

A components can be rendered into another component by adding it to the model and referencing it as an HTML element.

```javascript
const child = uav.component('<div>I am a child.</div>');

uav.component({child}, `
    <div>
        This is a component with a child.
        <child></child>
    </div>
`);
```

This will render the following:

```html
<div>
    This is a component with a child.
    <div>I am a child.</div>
</div>
```

> Note: child components must use names that are both valid javascript properties and valid HTML tags. Notably, this disallows using camel case for child component names.

## Passing Data to Children

```javascript
const child = data => uav.component({data}, `<div>{data}</div>`);

const model = uav.model({
    child: child('This is passed from parent to child.')
});

uav.component(model, `
    <div>
        This component passes data to its child.
        <child></child>
    </div>
`);
```

This will render the following into the `#app` component:

```html
<div>
    This component passes data to its child.
    <div>This is passed from parent to child.</div>
</div>
```

## Special Attributes

### data-src

Imagine that an image source is bound to a template expression:

`uav.component('<img src="{imageSource}" />');`

To prevent your browser from making a request to `/{imageSource}` before your JavaSrcript runs, you can use the `data-src` attribute.

`uav.component('<img data-src="{imageSource}" />');`

### data-style

Internet Explorer can be extremely picky about the value of an inline `style` tag. A template expression like the following will work in any browser except IE:

`uav.component('<div style="left: {left}px"></div>');`

To support Internet Explorer, you can use the `data-style` attribute instead:

`uav.component('<div data-style="left: {left}px"></div>');`

## DOM Access

Elements can be accessed by passing a selector to the `uav` function.

Access the first matched element:

`uav('.item').classList.toggle('visible');`

Access all matched elements by passing a callback:

`uav('.item', item => item.classList.toggle('visible'));`

Access the nth matched element:

`uav('.item', 3).classList.toggle('visible');`

## Collapsing Whitespace

Using multiline template strings creates unnecessary whitespace in your javascript files. To collapse whitespace, add a step like this to your build process:

`tr -s " " < dist/bundle.js > dist/tmp && mv dist/tmp dist/bundle.js`

## Browser Compatibility

IE9+
