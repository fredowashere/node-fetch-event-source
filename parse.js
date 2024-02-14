const NEW_LINE = 10;
const CARRIAGE_RETURN = 13;
const SPACE = 32;
const COLON = 58;

// Converts a ReadableStream into a callback pattern
async function getBytes(body, onChunk) {
    return new Promise(resolve => {
        
        body.on("readable", () => {
            let chunk;
            while (null !== (chunk = body.read())) {
                onChunk(chunk);
            }
        });

        body.on("end", resolve);
    });
}

// Parses arbitary byte chunks into EventSource line buffers
function getLines(onLine) {

    let buffer;
    let position; // Current read position
    let fieldLength; // Length of the `field` portion of the line
    let discardTrailingNewline = false;

    // Return a function that can process each incoming byte chunk
    return function onChunk(arr) {

        if (buffer === undefined) {
            buffer = arr;
            position = 0;
            fieldLength = -1;
        }
        else { // We're still parsing the old line. Append the new bytes into buffer
            buffer = concat(buffer, arr);
        }

        const bufLength = buffer.length;
        let lineStart = 0; // Index where the current line starts
        while (position < bufLength) {

            if (discardTrailingNewline) {
                if (buffer[position] === NEW_LINE) {
                    lineStart = ++position; // Skip to next char
                }
                discardTrailingNewline = false;
            }
            
            // Start looking forward till the end of line
            let lineEnd = -1; // Index of the \r or \n char
            for (; position < bufLength && lineEnd === -1; ++position) {
                switch (buffer[position]) {
                    case COLON:
                        // First colon in line
                        if (fieldLength === -1) {
                            fieldLength = position - lineStart;
                        }
                        break;
                    case CARRIAGE_RETURN:
                        discardTrailingNewline = true;
                    case NEW_LINE:
                        lineEnd = position;
                        break;
                }
            }

            // We reached the end of the buffer but the line hasn't ended, wait for the next arr and then continue parsing
            if (lineEnd === -1) break;

            // We've reached the line end, send it out
            onLine(buffer.subarray(lineStart, lineEnd), fieldLength);
            lineStart = position; // We're now on the next line
            fieldLength = -1;
        }

        if (lineStart === bufLength) {
            buffer = undefined; // We've finished reading it
        }
        else if (lineStart !== 0) {
            // Create a new view into buffer beginning at lineStart so we don't need to copy over the previous lines when we get the new arr
            buffer = buffer.subarray(lineStart);
            position -= lineStart;
        }
    }
}

/// Parses line buffers into EventSourceMessages
function getMessages(onId, onRetry, onMessage) {

    let message = newMessage();
    const decoder = new TextDecoder();

    // Return a function that can process each incoming line buffer
    return function onLine(line, fieldLength) {

        if (line.length === 0) { // Empty line denotes end of message. Trigger the callback and start a new message
            onMessage && onMessage(message);
            message = newMessage();
        }
        else if (fieldLength > 0) { // Exclude comments and lines with no values
            
            const field = decoder.decode(line.subarray(0, fieldLength));
            const valueOffset = fieldLength + (line[fieldLength + 1] === SPACE ? 2 : 1);
            const value = decoder.decode(line.subarray(valueOffset));

            switch (field) {
                case "data":
                    // If this message already has data...  
                    message.data = message.data
                        ? message.data + "\n" + value // ...then append the new value to the old
                        : value; // ...otherwise, just set to the new value
                    break;
                case "event":
                    message.event = value;
                    break;
                case "id":
                    onId(message.id = value);
                    break;
                case "retry":
                    const retry = parseInt(value, 10);
                    if (!isNaN(retry)) {
                        onRetry(message.retry = retry);
                    }
                    break;
            }
        }
    }
}

function concat(a, b) {
    const res = new Uint8Array(a.length + b.length);
    res.set(a);
    res.set(b, a.length);
    return res;
}

function newMessage() {
    return {
        data: "",
        event: "",
        id: "",
        retry: undefined,
    };
}

module.exports = {
    getBytes,
    getLines,
    getMessages
}