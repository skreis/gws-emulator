//
// manager.js maintains the state of chat threads
//
var _ = require('underscore'),
    storage = require('node-persist'),
    uuid = require('node-uuid');

// hash of chat id => intervalObject
var activeTimers = {};

// init persist of chat data
storage.initSync({
    dir: '../../../chats',
    stringify: JSON.stringify,
    parse: JSON.parse,
    encoding: 'utf8',
    logging: false,
    continuous: false,
    interval: 10
});

/**
 * Helper to append a message of a specific type to the given chat thread,
 * specifying the participant and any additional message data to include
 * @param chatId unique identifier of chat thread
 * @param participantId user identifier
 * @param type of message
 * @param pairs any additional tuples to include in the message
 */
function appendMessage(chatId, participantId, type, pairs) {
    var chat = storage.getItem(chatId);
    if (!chat) {
        return false;
    }

    // user has stated they've completed 
    // the chat - no new messages allowed
    if ('Idle' === chat.state) {
        return false;
    }

    // find participant by id (customer/agent)
    var participant = _.findWhere(chat.participants, {
        participantId: participantId
    });

    // on particular events, change the state
    switch (type) {
        case 'ParticipantJoined':
            chat.state = 'WaitingForAgent';
            break;
        case 'ParticipantLeft':
            chat.state = 'Idle';
            break;
    }
    // construct message
    message = _.extend({
        'type': type,
        'from': {
            'nickname': participant.nickname,
            'participantId': participantId,
            'type': participant.type
        }
    }, pairs);
    chat.messages = chat.messages || [];
    chat.messages.push(message);

    storage.setItem(chat.id, chat);
    return true;
}

/**
 * Adds a new participant to the already-existing chat
 * @param chat thread to add to
 * @param id new participant
 * @param nickname participant nickname
 * @param type customer/agent
 */
function addParticipant(chat, id, nickname, type) {
    var participant = {
        'nickname': nickname,
        'participantId': id,
        'type': type
    };
    chat.participants.push(participant);
    return participant;
}

/**
 * Returns true when the participant is found to exist (by ID)
 * This function is used to determine if the agent has joined before
 */
function participantExists(chatId, id) {
    var chat = storage.getItem(chatId);
    return _.findWhere(chat.participants, {
        participantId: id
    });
}

/**
 * Returns a newly created chat thread
 * @param nickname user nickname
 * @param subject chat subject
 * @return {Chat}
 */
exports.initChat = function(nickname, subject) {
    var chat = {
        'id': uuid.v4(),
        'state': '',
        'nickname': nickname,
        'subject': subject,
        'participants': [],
        'index': 0
    };

    addParticipant(chat, 1, nickname, 'Customer');
    addParticipant(chat, 2, 'system', 'External');

    // persist addition of participants
    storage.setItem(chat.id, chat);

    // add messages
    appendMessage(chat.id, 1, 'ParticipantJoined', {});
    appendMessage(chat.id, 2, 'ParticipantJoined', {});

    // add timer, periodically inserting a message
    // into the thread until it becomes completed
    activeTimers[chat.id] = setInterval(function() {
        appendMessage(chat.id, 2, 'Text', { text: 'Current Time: ' + new Date() });
    }, 1000 * 20);

    // after 1-3 seconds, add an agent participant into the mix
    var delay = 1000 * (Math.floor(Math.random() * 3) + 1);
    setTimeout(function() {
        addParticipant(chat, 3, 'Roboto', 'Agent');
        appendMessage(chat.id, 3, 'ParticipantJoined', {});
        chat.state = 'Chatting';
        storage.setItem(chat.id, chat);
    }, delay);

    return chat;
};

/**
 * Returns serialized version of chat object
 * @param id unique identifier of chat thread
 * @return {ChatMetadata}
 */
exports.getChat = function(id) {
    var chat = storage.getItem(id);
    if (!chat) {
        return undefined;
    }
    return {
        'chat': {
            'capabilities': [
                'SendMessage',
                'SendStartTypingNotification',
                'SendStopTypingNotification',
                'Complete'
            ],
            'id': chat.id,
            'participants': chat.participants,
            'state': chat.state
        },
        'statusCode': 0
    };
};

/**
 * Returns the most recent unreceived chat messages associated with a particular chat thread
 * @param id unique identifier of chat thread
 * @param index optional starting index
 * @return {ChatTranscript}
 */
exports.getTranscript = function(id, index) {
    var chat = storage.getItem(id);
    if (!chat) {
        return undefined;
    }

    // key messages with an index value
    _.each(chat.messages, function(message, index) {
        message.index = index + 1;
    });

    var messages = [];
    var start = (index) ? (parseInt(index) - 1) : chat.index;

    // if the requested index is within the bounds of our
    // thread, slice the message array and return the requested piece
    if (chat.messages && start < chat.messages.length && start >= 0) {
        messages = chat.messages.slice(start);
    }

    // bump the transcript
    if (!_.isEmpty(messages)) {
        chat.index = messages[messages.length - 1].index;
        storage.setItem(chat.id, chat);
    }

    return {
        'messages': messages,
        'statusCode': 0
    };
};

/**
 * Append message text to the chat thread from participant
 */
exports.sendMessage = function(id, text) {
    if (appendMessage(id, 1, 'Text', {
        text: text
    })) {

        // check if the 'agent' has been added yet...
        if (!participantExists(id, 3)) {
            return true;
        }

        var agentResponse;
        text = text.trim();

        // some non-scientific canned responses based on punctuation
        switch (text[text.length - 1]) {
            case '!':
                agentResponse = 'Neat.';
                break;
            case '?':
                agentResponse = 'Good question...';
                break;
            case '.':
                agentResponse = 'Ok.';
                break;
            default:
                agentResponse = text + ' to you too!';
        }

        // include 'response' from agent
        var delay = Math.floor(Math.random() * 2000);
        setTimeout(function() {
            appendMessage(id, 3, 'Text', {
                text: agentResponse
            });
        }, delay);

        return true;
    }
    return false;
};

/**
 * Send started typing notification to chat thread from participant
 */
exports.sendTypingStartNotification = function(id) {
    return appendMessage(id, 1, 'TypingStarted', {});
};

/**
 * Send stopped typing notification to chat thread from participant
 */
exports.sendTypingStopNotification = function(id) {
    return appendMessage(id, 1, 'TypingStopped', {});
};

/**
 * Send chat complete to thread from participant
 */
exports.completeChat = function(id) {
    clearInterval(activeTimers[id]);
    delete activeTimers[id];
    return appendMessage(id, 1, 'ParticipantLeft', {});
};