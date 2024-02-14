const nodeFetch = require("node-fetch");
const { getBytes, getLines, getMessages } = require("./parse");

const DefaultRetryInterval = 1000;
const LastEventId = "last-event-id";

function defaultOnOpen(response) {
    const contentType = response.headers.get("content-type");
    if (!(contentType && contentType.startsWith(EventStreamContentType))) {
        throw new Error(`Expected content-type to be ${EventStreamContentType}, Actual: ${contentType}`);
    }
}

const EventStreamContentType = "text/event-stream";

function fetchEventSource(
    input,
    {
        signal: inputSignal,
        headers: inputHeaders,
        onopen: inputOnOpen,
        onmessage,
        onclose,
        onerror,
        openWhenHidden,
        fetch: inputFetch,
        ...rest
    }
) {
    return new Promise((resolve, reject) => {
        
        const headers = { ...inputHeaders }; // Make a copy, we may modify it
        if (!headers.accept) {
            headers.accept = EventStreamContentType;
        }

        let curRequestController; // Defined inside the create function below
        let retryInterval = DefaultRetryInterval;
        let retryTimer = 0;

        function dispose() {
            clearTimeout(retryTimer);
            curRequestController.abort();
        }

        // Signal aborts, dispose and resolve
        inputSignal && inputSignal.addEventListener("abort", () => {
            dispose();
            resolve();
        });

        const fetch = inputFetch ?? nodeFetch;
        const onopen = inputOnOpen ?? defaultOnOpen;

        async function create() {

            curRequestController = new AbortController();

            try {

                const response = await fetch(input, {
                    ...rest,
                    headers,
                    signal: curRequestController.signal,
                });

                await onopen(response);

                await getBytes(
                    response.body,
                    getLines(
                        getMessages(
                            id => {
                                if (id) {
                                    // Store the id and send it back on the next retry
                                    headers[LastEventId] = id;
                                }
                                else {
                                    // Don't send the last-event-id header anymore
                                    delete headers[LastEventId];
                                }
                            },
                            retry => retryInterval = retry,
                            onmessage
                        )
                    )
                );

                onclose && onclose();
                dispose();
                resolve();
            }
            catch (err) {

                // If we have aborted the request return immediately
                if (curRequestController.signal.aborted) {
                    return;
                }
                
                try { // Check if we need to retry
                    const interval = (onerror && onerror(err)) ?? retryInterval;
                    clearTimeout(retryTimer);
                    retryTimer = setTimeout(create, interval);
                }
                catch (innerErr) { // Do not retry anymore
                    dispose();
                    reject(innerErr);
                }
            }
        }

        create();
    });
}

module.exports = fetchEventSource;