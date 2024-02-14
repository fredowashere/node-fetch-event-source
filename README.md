# Node Fetch Event Source
This package provides a better API for making [Event Source requests](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events) - also known as server-sent events - with all the features available in the [Node-Fetch API](https://www.npmjs.com/package/node-fetch).

The [default browser EventSource API](https://developer.mozilla.org/en-US/docs/Web/API/EventSource) imposes several restrictions on the type of request you're allowed to make: the [only parameters](https://developer.mozilla.org/en-US/docs/Web/API/EventSource/EventSource#Parameters) you're allowed to pass in are the `url` and `withCredentials`, so:
* You cannot pass in a request body: you have to encode all the information necessary to execute the request inside the URL, which is [limited to 2000 characters](https://stackoverflow.com/questions/417142) in most platforms.
* You cannot pass in custom request headers
* You can only make GET requests - there is no way to specify another method.
* If the connection is cut, you don't have any control over the retry strategy: the browser will silently retry for you a few times and then stop, which is not good enough for any sort of robust application.

This library provides an alternate interface for consuming server-sent events, based on the [Node-Fetch API](https://www.npmjs.com/package/node-fetch). It is fully compatible with the [Event Stream format](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events#Event_stream_format), so if you already have a server emitting these events, you can consume it just like before. However, you now have greater control over the request and response so:

* You can use any request method/headers/body, plus all the other functionality exposed by [Node-Fetch API](https://www.npmjs.com/package/node-fetch). You can even provide an alternate fetch implementation, if the default implementation doesn't work for you.
* You have access to the response object if you want to do some custom validation/processing before  parsing the event source. This is useful in case you have API gateways (like nginx) in front of your application server: if the gateway returns an error, you might want to handle it correctly.
* If the connection gets cut or an error occurs, you have full control over the retry strategy.

# Install
```sh
npm install node-fetch-event-source
```

# Usage
```js
const fetch = require("./node-fetch-event-source");

await fetch("/api/sse", {
    onmessage(ev) {
        console.log(ev.data);
    }
});
```

You can pass in all the [other parameters](https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/fetch#Parameters) exposed by the default fetch API, for example:
```js
const controller = new AbortController();
setTimeout(() => {
    controller.abort();
    console.log("Aborted! (timeout 3s)");
}, 3000);

await fetch(
    "/api/sse",
    {
        async onopen(response) {
            console.log("onopen", response);
        },
        onmessage(msg) {
            console.log("onmessage", msg);
        },
        onclose() {
            console.log("onclose");
        },
        onerror(err) {
            console.log("onerror", err);
        },
        signal: controller.signal,
        method: "POST",
        headers: {
            Authorization: `Bearer ${<<< YOUR AUTH TOKEN HERE >>>}`,
        },
        body: JSON.stringify(<<< YOUR JSON BODY HERE >>>);
    }
);
```

# Typings
This library is written in JavaScript, in case you want the TypeScript typings just ping me! I don't need those so I didn't bother adding them.

# Contributing
In case you want to contribute to this project, then just fork the repository, make a PR, and I'll review and if everything is fine merge it.
