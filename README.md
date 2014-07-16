# GWS Chat

Unlike the majority of APIs exposed by Genesys Web Services, this API is intended to be used by customers to submit chat requests to agents, opposed to being used by users known to GWS (agents, supervisors, etc.).

## RESTful API

### Authentication

When utilizing the GWS Chat Service, an `apikey` header is required to initiate a chat session and participate in the chat thread.  The `apikey` header is the constant value `N18TFGbKpn0zaGLXDFZhPWpTcB2eyx44`.

### Resources

* [RequestChat](#requestchat)
* [SendStartTypingNotification](#sendstarttypingnotification)
* [SendStopTypingNotification](#sendstoptypingnotification)
* [SendMessage](#sendmessage)
* [Complete](#complete)
* [GetChat](#getchat)
* [GetTranscript](#gettranscript)

### RequestChat

#### Overview

This operation submits a new chat request for the website visitor / customer. After successfully sending this request to start the chat, you should begin checking for updated state and new messages periodically.

```
POST {baseUrl}/v2/chats
```

**Parameters**

| Name | Type | Value |
|:-----|------|-------|
| operationName | string | `RequestChat` |
| nickname | string | Nickname of the customer requesting chat |
| subject | string | Subject of the chat request |

**Example**

`POST /api/v2/chats`

```json
{
    "operationName": "RequestChat",
    "nickname": "James",
    "subject": "Question about relativity"
}
```

**Response**

`Status: 200 OK`
```json
{ 
  "id" : "652492d9-c2d9-44c9-b9ad-0ab7984114bb",
  "statusCode" : 0,
  "path" : "/api/v2/chats/652492d9-c2d9-44c9-b9ad-0ab7984114bb"
}
```

### SendStartTypingNotification

#### Overview

This operation notifies the chat that the customer has started typing.

```
POST {baseUrl}/v2/chats/:id
```

**Parameters**

| Name | Type | Value |
|:-----|------|-------|
| operationName | string | `SendStartTypingNotification` |

**Example**

`POST /api/v2/chats/652492d9-c2d9-44c9-b9ad-0ab7984114bb`
```json
{
    "operationName": "SendStartTypingNotification"
}
```

**Response**

`Status: 200 OK`
```json
{ 
  "statusCode" : 0,
}
```

### SendStopTypingNotification

#### Overview

This operation notifies the chat that the customer has stopped typing.

```
POST {baseUrl}/v2/chats/:id
```

**Parameters**

| Name | Type | Value |
|:-----|------|-------|
| operationName | string | `SendStopTypingNotification` |

**Example**

`POST /api/v2/chats/652492d9-c2d9-44c9-b9ad-0ab7984114bb`
```json
{
    "operationName": "SendStopTypingNotification"
}
```

**Response**

`Status: 200 OK`
```json
{ 
  "statusCode" : 0,
}
```

### SendMessage

#### Overview

This requests sends a new text message to the chat.

```
POST {baseUrl}/v2/chats/:id
```

**Parameters**

| Name | Type | Value |
|:-----|------|-------|
| operationName | string | `SendMessage` |
| text | string | The text to be sent |

**Example**

`POST /api/v2/chats/652492d9-c2d9-44c9-b9ad-0ab7984114bb`
```json
{
    "operationName": "SendMessage",
    "text": "Are you there?"
}
```

**Response**

`Status: 200 OK`
```json
{ 
  "statusCode" : 0,
}
```

### Complete

#### Overview

This operation is used to complete the chat. After sending this request, no further requests should be sent for the chat.

```
POST {baseUrl}/v2/chats/:id
```

**Parameters**

| Name | Type | Value |
|:-----|------|-------|
| operationName | string | `Complete` |

**Example**

`POST /api/v2/chats/652492d9-c2d9-44c9-b9ad-0ab7984114bb`
```json
{
    "operationName": "Complete"
}
```

**Response**

`Status: 200 OK`
```json
{ 
  "statusCode" : 0,
}
```

### GetChat

#### Overview

This request returns the specified chat resource. Send this request periodically to keep state up to date.

```
GET {baseUrl}/v2/chats/:id
```

**Parameters**

| Name | Type | Value |
|:-----|------|-------|
| *N/A* | *N/A* | *N/A* |


**Capabilities**

The `capabilities` property of the chat resource provides an array of operation names that are valid for the current state of the chat.

**Participants**

The `participants` property will include details of all known chat participants.

**States**

The `state` property of the chat resource can have one of the following values:
   * `WaitingForAgent` - agent not yet joined
   * `Chatting` - agent has joined, chat has begun
   * `Idle` - user has disconnected

**Example**

```
GET /api/v2/chats/652492d9-c2d9-44c9-b9ad-0ab7984114bb
```

**Response**

`Status: 200 OK`
```json
{
    "chat": {
        "capabilities": [
            "SendMessage",
            "SendStartTypingNotification",
            "SendStopTypingNotification",
            "Complete"
        ],
        "id": "652492d9-c2d9-44c9-b9ad-0ab7984114bb",
        "participants": [
            {
                "nickname": "Chris",
                "participantId": "1",
                "type": "Customer"
            }
        ],
        "state": "WaitingForAgent"
    },
    "statusCode": 0
}
```

### GetTranscript

#### Overview

Send this request periodically to retrieve new chat messages. By specifying the index parameter, previous messages can be recovered (ex. index=0 will return all messages).

```
GET {baseUrl}/v2/chats/:id/messages
```

**Parameters**

| Name | Type | Value |
|:-----|------|-------|
| index | int | **Optional**. The index of the first entry to return. If not specified, will return messages that the client has not received yet. |

**Types**

The `type` property can contain any of the following values:
  * Text
  * ParticipantJoined
  * ParticipantLeft
  * TypingStarted
  * TypingStopped

**Example**

```
GET /api/v2/chats/652492d9-c2d9-44c9-b9ad-0ab7984114bb/messages
```

**Response**

`Status: 200 OK`
```json
{
    "messages": [
        {
            "from": {
                "nickname": "Chris",
                "participantId": "1",
                "type": "Customer"
            },
            "index": 1,
            "type": "ParticipantJoined"
        },
        {
            "from": {
                "nickname": "Chris",
                "participantId": "1",
                "type": "Customer"
            },
            "index": 2,
            "text": "Hello?",
            "type": "Text"
        },
        {
            "from": {
                "nickname": "Kristi Sippola",
                "participantId": "2",
                "type": "Agent"
            },
            "index": 3,
            "type": "ParticipantJoined"
        }
    ],
    "statusCode": 0
}
```

---

## Sample Client / Server

The following are example client & sample server applications which can be used to emulate the capability of the HTCC e-Services chat server.  Chat threads are persisted to disk and therefore the server can be restarted without fear of losing data.  Note: the server emulator does not evaluate the `apikey` header.

When a client initiates a chat thread with the server, a "system" participant will join who will provide a periodic message of type "External" to the thread.  In addition, an "agent" participant joins at a random interval shortly thereafter (< 5 seconds).  As each message is submitted from the client, another message is added from the "agent" to the thread using a non-scientific method of evaluating the last character from the client's message and attempting to respond with an appropriate string.

### Structure

```
.
├── LICENSE
├── README.md
├── client
│   ├── index-apigee.html
│   ├── index.html
│   └── src
├── examples
│   └── php
└── server
    ├── log4js.json
    ├── manager.js
    ├── package.json
    └── server.js
```

### Setup

```
$ cd server && npm install
```

### Run

You may specify an optional port by setting a `PORT` environment variable to the port you wish to listen on.

```
$ node server.js
```

Once started, two subdirectories will be created `logs` and `chats`.  In them you may find associated persisted data.


### Client

Access to the sample web client application can be found by directing your browser to [http://localhost:8888/client/](http://localhost:8888/client/)


### Sample Code

There are some samples of api usage in various languages in `examples` folder


### Coding Notes

You can code against the Chat API running locally when following the setup & run instructions above or remotely against a hosted instance of the HTCC e-Services chat server by utilizing one of the following `baseUrl` values:

| Local | Remote |
|:------|:-------|
| [http://127.0.0.1:8888/api](http://127.0.0.1:8888/api) | [http://vladm-prod.apigee.net/chat-key](http://vladm-prod.apigee.net/chat-key) |

Please notice a minor difference in context of URLs and remember to set the `apikey` header.
