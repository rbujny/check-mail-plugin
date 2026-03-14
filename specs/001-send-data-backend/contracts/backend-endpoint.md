# Contract: Backend Process Endpoint

## Overview
This contract outlines the data format and interaction mode between the Chrome Extension and the local development backend (`http://localhost:8080/process.php`).

### 1. Endpoint
**HTTP Method**: `POST`  
**URL Path**: `http://localhost:8080/process.php`  
**Content-Type**: `application/json`

### 2. Request Schema
The payload sent by the extension.
```json
{
  "$schema": "http://json-schema.org/draft-04/schema#",
  "type": "object",
  "properties": {
    "headers": {
      "type": "object",
      "additionalProperties": { "type": "string" },
      "description": "Dictionary of email headers such as From, To, Subject, DKIM, DMARC, SPF, etc."
    },
    "bodyText": {
      "type": "string",
      "description": "The textual content of the email extracted."
    }
  },
  "required": [
    "headers",
    "bodyText"
  ]
}
```

### 3. Response Requirements
The extension does not formally process a response payload for this feature, but it expects standard HTTP status codes:
- **`200 OK` or `201 Created`**: The backend successfully received and processed the data. The extension will consider the transmission complete.
- **`4xx / 5xx`**: Any explicit error code triggers the retry mechanism in the background service worker, eventually failing and displaying a user notification.

### Notes
- The endpoint URL will eventually need to be configurable per environment in future phases, but is hardcoded to `http://localhost:8080/process.php` for MVP.
