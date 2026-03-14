# Quickstart: Testing the Backend Integration

This guide explains how to quickly test the `001-send-data-backend` feature, ensuring the extension properly sends HTTP POST requests to the `http://localhost:8080/process.php` endpoint.

## 1. Local Backend Setup
Since the extension requires a localized endpoint, ensure you have a dummy server capable of accepting POST requests at `localhost:8080/process.php`.

Options:
1. Run a local Node.js server to log incoming structured data.
2. Serve a simple PHP script capable of handling `$HTTP_RAW_POST_DATA` or `file_get_contents('php://input')`.
3. Use a tool like [Netcat](https://eternallybored.org/misc/netcat/) on port 8080.

## 2. Testing Normal Flow
1. Install or reload the Chrome Extension bundle (`npm run dev` or `npm run build` and follow typical sideloading instructions).
2. Open Gmail and click on an active email.
3. Observe your local backend's console. It should output the JSON payload containing the `headers` and `bodyText`.
4. Check the Chrome Developer Tools Console (F12) on the Gmail tab—no raw email data should be logged.

## 3. Testing Failure Fallbacks
1. Stop your local backend server.
2. Select a new email in Gmail or click the extension button to force data extraction/transmission.
3. Keep the Chrome DevTools network tab open. You will notice the extension retrying the request up to 3 times (spaced 1 second apart).
4. After 3 attempts, observe the DOM or notification state on the Gmail page. The extension should inject or pop up a "Network Failed" or "Request could not be handled" notification, demonstrating Graceful Degradation.
