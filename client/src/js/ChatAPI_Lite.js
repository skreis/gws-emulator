
function GenesysChatAPI(jQuery_inject){

    var $ = jQuery_inject||jquery||$||null;

    function Chat(){
      
        'use strict';

        var Deferred = $.Deferred,
            DEFAULT_USERNAME = 'User',
            transport,
            log;



        this.startSession = function(params){

            var dfd;

            if(!params.chatServerUrl && !params.transport){

                throwError('either chatServerUrl or a custom transport must be provided');
            }

            log = params.logger || $.noop;
            transport = getTransport(params);
            dfd = new Deferred();

            log('startSession: initializing transport');

            transport.init().fail(

                createTransportFailureResolver(dfd, log)

            ).done(

                function(){
                    
                    var startSessionParams = {

                        username:   params.username,
                        userData:   params.userData,
                        source:     params.source,
                        subject:    params.subject
                    };

                    if(!startSessionParams.username){
                        
                        startSessionParams.username = DEFAULT_USERNAME;
                    }

                    log('startSession: transport initialized, starting session ', startSessionParams);

                    transport.startSession(startSessionParams).done(function(event){

                        log('startSession request returned ', event);
                        log('startSession succeeded');

                        dfd.resolve(

                            new Session({

                                state: {

                                    sessionId: event.sessionId,
                                    chatServerUrl: params.chatServerUrl,
                                    lastIndex: 0
                                },
                                transport: transport,
                                stateStorage: getStateStorage(params),
                                logger: log
                            })
                        );
                    });
                }
            );

            return getSimplePromise(dfd);
        };

        this.restoreSession = function(params){

            var dfd, theStateStorage, state, sessionParams;

            params = params || {};

            log = params.logger || $.noop;
            dfd = new Deferred();
            theStateStorage = getStateStorage(params);
            state = theStateStorage.read();



            if(!state || !state.sessionId){

                dfd.reject(

                    createErrorEvent({description: 'restoreSession() failed to read state'})
                );

            }else{

                transport = getTransport($.extend({}, params, {chatServerUrl: state.chatServerUrl}));

                sessionParams = {

                    state: state,
                    transport: transport,
                    stateStorage: theStateStorage,
                    logger: log
                };

                log('restoreSession: initializing transport');
                
                transport.init().fail(

                    createTransportFailureResolver(dfd, log)

                ).done(

                    function(){

                        log('restoreSession: transport initialized, restoring the session ', sessionParams);
                        dfd.resolve(new Session(sessionParams));
                    }
                );
            }

            return getSimplePromise(dfd);
        };
    }
















    function Session(params){


        'use strict';



        var ERROR = 'Error',
            AGENT_CONNECTED = 'AgentConnected',
            AGENT_DISCONNECTED = 'AgentDisconnected',
            AGENT_TYPING = 'AgentTyping',
            MESSAGE_RECEIVED = 'MessageReceived',
            SESSION_ENDED = 'SessionEnded',
            VALIDATE_TRANSPORT_RESPONSES = true;


        var session = this,
            sessionId = params.state.sessionId,
            transport = params.transport,
            stateStorage = params.stateStorage,
            lastMessageIndex = params.state.lastIndex,
            log = params.logger || $.noop,
            Deferred = $.Deferred,
            CHAT_HISTORY_KEY = 'com.genesys.chat',
            isActive = true,
            // A map of reasons (transport will give us 1, 2 or 3)
            SESSION_END_REASONS = [undefined, 'leaveRequest', 'agent', 'error'],
            transportEvents = {},
            isStorageSupported,
            saveToHistoryStorage;

        isStorageSupported = (function() {
            log('testing sessionStorage support...');
            try {
                sessionStorage.setItem(CHAT_HISTORY_KEY, CHAT_HISTORY_KEY);
                sessionStorage.removeItem(CHAT_HISTORY_KEY);
                log('...supported');
                return true;
            } catch (e) {
                log('...not supported');
                return false;
            }
        }());

        function throwSessionEnded() {
            throwError('session has ended');
        }

        function validateSession() {
            if (!isActive) {
                throwSessionEnded();
            }
        }

        function bindStateSaving() {
            log('binding state saving');

            $(window).on('unload.gChat beforeunload.gChat', function() {
                stateStorage.write($.extend(params.state, {
                    lastIndex: lastMessageIndex
                }));
            });
        }

        function unbindStateSaving() {
            log('unbinding state saving');
            $(window).off('.gChat');
        }

        function replayTranscript(transcript, restored) {
            log('replaying transcript');
            $.each(transcript, function(i, entry) {
                var eventSpec = transportEvents[entry.type];
                entry.restored = !! restored;
                eventSpec.event.fire(eventSpec.filter(entry));
            });
        }

        /**
         * Get unique key for storing chat history in session storage.
         * @returns {string}
         * @private
         */
        function getSessionStorageKey() {
            return CHAT_HISTORY_KEY + '.' + sessionId;
        }

        function clearHistoryStorage() {
            if (!isStorageSupported) {
                return;
            }
            log('clearing history storage');
            sessionStorage.removeItem(getSessionStorageKey());
        }

        saveToHistoryStorage = (function() {
            var history = [];
            if (!isStorageSupported) {
                return $.noop;
            }
            return function(event) {
                // Support passing both one and multiple events
                if ($.type(event) === "array") {
                    history = history.concat(event);
                } else {
                    history.push(event);
                }
                log('saving history to storage ', history);
                sessionStorage.setItem(getSessionStorageKey(), JSON.stringify(history));
            };
        }());

        function fetchAndReplayTranscript() {
            validateSession();

            log('fetching history from server');
            session.getTranscript()
                .done(function(data) {
                    log('fetched history from server ', data);
                    if (data && data.transcript) {
                        replayTranscript(data.transcript, true);
                        saveToHistoryStorage(data.transcript);
                    }
                });
        }

        function restoreHistoryFromStorage() {
            var history, lastIndexFromHistory;
            if (!isStorageSupported) {
                return false;
            }
            history = JSON.parse(sessionStorage.getItem(getSessionStorageKey()));
            log('restoring history from storage ', history);
            if (!history || !history.length) {
                return false;
            }
            // Handle a tricky case:
            // 1) user and agent chat on a page
            // 2) user navigate to another subdomain,
            //    history is stored in sessionStorage
            // 3) on new subdomain sessionStorage is empty,
            //    history is retrieved from server
            // 4) user and agent chat more
            // 5) user goes back to 1st page
            // 6) history is restored from storage, but
            //    all history from step 4 is missing

            lastIndexFromHistory = history[history.length-1].index

            if (lastIndexFromHistory !== lastMessageIndex) {
                log('history and state indexes do not match', lastIndexFromHistory,
                    lastMessageIndex);
                return false;
            }
            replayTranscript(history, true);
            saveToHistoryStorage(history);
            return true;
        }

        function tryToRestoreHistory() {
            var restored = restoreHistoryFromStorage();
            if (!restored) {
                fetchAndReplayTranscript();
            }
        }

        function onSessionEnded() {
            log('session ended, clearing up');
            unbindStateSaving();
            clearHistoryStorage();
            isActive = false;
        }

        function getSessionEndedReason(reasonId) {
            var obj = {};
            obj[SESSION_END_REASONS[reasonId]] = true;
            return obj;
        }


        this.sendMessage = function(params) {
            var dfd, messageData;
            validateSession();
            // Shortcut for sendMessage('a string')
            if ($.type(params) === "string") {
                params = {
                    message: params,
                    type: 'text'
                };
            }
            validateObject(params, {
                message: 'string',
                type: 'string'
            });
            if (params.type !== 'text' && params.type !== 'url') {
                throwError('type must be "url" or "text"');
            }

            dfd = new Deferred();
            messageData = {
                sessionId: sessionId,
                message: params.message,
                type: params.type
            };

            log('sending message ', messageData);
            transport.sendMessage(messageData)
                .fail(createTransportFailureResolver(dfd, log))
                .done(function() {
                    log('sending message done');
                    dfd.resolve();
                });

            return getSimplePromise(dfd);
        };

        this.getTranscript = function(params) {
            var dfd, transportParams;
            validateSession();
            params = params || {
                fromIndex: 0
            };
            validateObject(params, {
                fromIndex: 'number'
            });
            if (params && params.fromIndex < 0) {
                throwError('"fromIndex" must be >= 0');
            }

            dfd = new Deferred();
            transportParams = {
                sessionId: sessionId,
                fromIndex: (params && params.fromIndex) || 0
            };

            log('sending getTranscript ', transportParams);
            transport.getTranscript(transportParams)
                .fail(createTransportFailureResolver(dfd, log))
                .done(function(response) {
                    log('getTrasncript returned ', response);
                    if (!response || !response.transcript) {
                        dfd.reject(createErrorEvent({
                            description: 'No transcript came from transport'
                        }));
                        return;
                    }
                    dfd.resolve({
                        transcript: response && response.transcript
                    });
                });

            return getSimplePromise(dfd);
        };

        this.sendTyping = function(params) {
            var message = {},
                dfd;
            validateSession();
            params = params || {
                isTyping: true
            };
            validateObject(params, {
                isTyping: 'boolean',
                typedText: {
                    isa: 'string',
                    optional: true
                }
            });

            message.isTyping = params.isTyping;
            message.sessionId = sessionId;
            if (params.typedText) {
                message.typedText = params.typedText;
            }
            dfd = new Deferred();

            log('sending sendTyping ', message);
            transport.sendTyping(message)
                .fail(createTransportFailureResolver(dfd, log))
                .done(function() {
                    log('sendTyping done');
                    dfd.resolve();
                });

            return getSimplePromise(dfd);
        };

        this.leave = function() {
            var dfd = new Deferred();
            validateSession();

            // Clean up immediately because if e.g. user closes the page
            // before event returns from server then session will be
            // inappropriately restored.
            onSessionEnded();

            log('sending leaveSession ', sessionId);
            transport.leaveSession({
                sessionId: sessionId
            })
                .fail(createTransportFailureResolver(dfd, log))
                .done(function(data) {
                    log('leaveSession done ', data);
                    // Replay delta that may come with leaving the session
                    if (data && data.transcript) {
                        replayTranscript(data.transcript, false);
                        saveToHistoryStorage(data.transcript);
                    }
                    // Fire SessionEnded event since it won't be fired by server in
                    // this case and we want it to be fired for the sake of consistency.
                    transportEvents[SESSION_ENDED].event.fire({
                        reason: getSessionEndedReason(1),
                        restored: false
                    });
                    dfd.resolve();
                });

            return getSimplePromise(dfd);
        };

        this.setUserData = function(params) {
            var dfd, transportParams;
            validateSession();
            validateObject({
                params: params
            }, {
                params: 'plainObject'
            });

            dfd = new Deferred();
            transportParams = {
                userData: params,
                sessionId: sessionId
            };

            log('sending setUserData', transportParams);
            transport.setUserData(transportParams)
                .fail(createTransportFailureResolver(dfd, log))
                .done(function() {
                    log('setUserData done');
                    dfd.resolve();
                });

            return getSimplePromise(dfd);
        };

        this.getUserData = function(key) {
            var dfd, transportParams;
            validateSession();
            if (!($.type(key) === "string")){
                throwError('string key is required. Given: ' + typeof key);
            }

            dfd = new Deferred();
            transportParams = {
                keys: [key],
                sessionId: sessionId
            };

            log('sending getUserData ', transportParams);
            transport.getUserData(transportParams)
                .fail(createTransportFailureResolver(dfd, log))
                .done(function(event) {
                    log('getUserData done ', event);
                    var userData = event && event.userData;
                    if (!userData) {
                        dfd.reject(createErrorEvent({
                            description: 'No userData came from transport'
                        }));
                        return;
                    }
                    dfd.resolve({
                        userData: (event && event.userData) || {}
                    });
                });

            return getSimplePromise(dfd);
        };

        this.deleteUserData = function(key) {
            var dfd, transportParams;
            validateSession();
            if (!($.type(key) === "string")){
                throwError('string key is required. Given: ' + typeof key);
            }

            dfd = new Deferred();
            transportParams = {
                keys: [key],
                sessionId: sessionId
            };

            log('sending deleteUserData ', transportParams);
            transport.deleteUserData(transportParams)
                .fail(createTransportFailureResolver(dfd, log))
                .done(function() {
                    log('deleteUserData done');
                    dfd.resolve();
                });

            return getSimplePromise(dfd);
        };

        function createCallbackMethod(eventName) {
            return function(callback) {
                validateObject(arguments, [{
                    isa: 'function'
                }]);
                log('adding a callback for ' + eventName);
                transportEvents[eventName].event.add(callback);
            };
        }

        /**
         * Converts party type from string to boolean:
         * "Agent" => {agent:true}
         * Expects safe (validated) input.
         * @param {string} type Party type
         * @returns {{}}
         */
        function getPartyType(type) {
            var obj = {};
            obj[type.toLowerCase()] = true;
            return obj;
        }





        function validateAgentEvent(event){}
        function validateMessageReceivedEvent(event){}
        function validateIsTypingEvent(event){}
        function validateSessionEndedEvent(event){}





        function filterAgentEvent(event) {
            return {
                party: {
                    id: event.party.id,
                    name: event.party.name,
                    type: event.party.type // BEN FRIEND ADDITION: NEEDED TO FILTER BETWEEN AGENT AND CLIENT EVENT WHEN USING REST API
                },
                index: event.index,
                timestamp: event.timestamp,
                restored: !! event.restored
            };
        }

        function filterMessageReceivedEvent(event) {
            return {
                content: event.content,
                timestamp: event.timestamp,
                index: event.index,
                restored: !! event.restored,
                party: {
                    id: event.party.id,
                    name: event.party.name,
                    type: getPartyType(event.party.type)
                }
            };
        }

        function filterIsTypingEvent(event) {
            return {
                party: {
                    id: event.party.id,
                    name: event.party.name,
                    type: event.party.type // BEN FRIEND ADDITION: NEEDED TO FILTER BETWEEN AGENT AND CLIENT EVENT WHEN USING REST API
                },
                isTyping: event.isTyping,
                index: event.index
            };
        }

        function filterSessionEndedEvent(event) {
            return {
                reason: getSessionEndedReason(event.reason.id),
                restored: !! event.restored
            };
        }

        function filterErrorEvent(event) {
            event = event || {};
            return {
                error: event.error || createErrorEvent().error,
                restored: !! event.restored
            };
        }

        function createTransportListener(eventName) {

            var eventSpec = transportEvents[eventName];

            $.each(eventSpec.innerListeners||[], function(i, listener){

                eventSpec.event.add(listener);
            });

            return function(event) {
                log('got "' + eventName + '" raw transport event ', event);
                if (VALIDATE_TRANSPORT_RESPONSES) {
                    try {
                        eventSpec.validate(event);
                    } catch (e) {
                        transportEvents[ERROR].event.fire(createErrorEvent({
                            code: 0,
                            description: 'Transport error in ' + eventName + ' event (' + e.message + ')'
                        }));
                        return;
                    }
                }

                if (eventSpec.saveToHistory !== false) {
                    saveToHistoryStorage(event);
                    // Update state:
                    if (event.index) {
                        lastMessageIndex = event.index;
                    }
                }
                eventSpec.event.fire(eventSpec.filter(event));
            };
        }

        transportEvents[AGENT_CONNECTED] = {
            validate: validateAgentEvent,
            filter: filterAgentEvent,
            event: new MemorizedEvent()
        };
        transportEvents[AGENT_DISCONNECTED] = {
            validate: validateAgentEvent,
            filter: filterAgentEvent,
            event: new MemorizedEvent()
        };
        transportEvents[MESSAGE_RECEIVED] = {
            validate: validateMessageReceivedEvent,
            filter: filterMessageReceivedEvent,
            event: new MemorizedEvent()
        };
        transportEvents[AGENT_TYPING] = {
            validate: validateIsTypingEvent,
            filter: filterIsTypingEvent,
            event: new MemorizedEvent(),
            saveToHistory: false
        };
        transportEvents[SESSION_ENDED] = {
            validate: validateSessionEndedEvent,
            filter: filterSessionEndedEvent,
            event: new MemorizedEvent(),
            innerListeners: [
                onSessionEnded
            ]
        };
        transportEvents[ERROR] = {
            validate: $.noop,
            filter: filterErrorEvent,
            event: new MemorizedEvent()
        };

        transport.onError(createTransportListener(ERROR));
        transport.onAgentConnected(createTransportListener(AGENT_CONNECTED));
        transport.onAgentDisconnected(createTransportListener(AGENT_DISCONNECTED));
        transport.onAgentTyping(createTransportListener(AGENT_TYPING));
        transport.onMessageReceived(createTransportListener(MESSAGE_RECEIVED));
        transport.onSessionEnded(createTransportListener(SESSION_ENDED));

        this.onError = createCallbackMethod(ERROR);
        this.onAgentConnected = createCallbackMethod(AGENT_CONNECTED);
        this.onAgentDisconnected = createCallbackMethod(AGENT_DISCONNECTED);
        this.onAgentTyping = createCallbackMethod(AGENT_TYPING);
        this.onMessageReceived = createCallbackMethod(MESSAGE_RECEIVED);
        this.onSessionEnded = createCallbackMethod(SESSION_ENDED);

        bindStateSaving();
        if (lastMessageIndex !== 0) {
            tryToRestoreHistory();
        }
    }











    function StateStorage(options){

        'use strict';

        var cookieName = (options = options || {}).cookieName || 'gcState',
            domain = options.domain,
            path = '/',
            cookieMaxAge = options.cookieMaxAge || 5,
            log = options.logger || $.noop;

        return {

            read: function(){

                var value = $.cookie(cookieName);

                $.removeCookie(cookieName, {domain: domain, path: path});

                return value ? JSON.parse(value) : value;
            },

            write: function(state){
               
                if(state){

                    $.cookie(

                        cookieName, 
                        JSON.stringify(state), 
                        {
                            expires: new Date(new Date().getTime() + cookieMaxAge * 1000),
                            domain: domain,
                            path: path
                        }
                    );

                    log('saved state with cookie name: ', cookieName, ', domain: ', domain, ', max age: ', cookieMaxAge);
                }
            }
        };
    }






    function MemorizedEvent(){

        'use strict';
        var rememberedParams = [],
            callbacks = [];

        this.add = function(callback){

            if(rememberedParams.length){

                $.each(rememberedParams, function(i, data){
                    
                    callback(data);
                });
            }
            
            callbacks.push(callback);
        };

        this.fire = function(data){

            rememberedParams.push(data);

            $.each(callbacks, function(i, callback){

                callback(data);
            });
        };
    }






    function getTransport(params){

        return (params && params.transport) || transport || false;
    }

    function getStateStorage(params){

        return params.stateStorage || new StateStorage({
            
            // if undefined, stateStorage will use default
            cookieMaxAge: params.cookieMaxAge,
            log: params.logger
        });
    }

    function throwError(message){

        throw new TypeError('Genesys Chat: ' + message);
    }

    function getSimplePromise(deferred){

        var promise = deferred.promise();
        
        return {done: promise.done, fail: promise.fail};
    }

    function createErrorEvent(error){

        error = error || {};

        return {
            
            error: {code: error.code || 0, description: error.description}
        };
    }

    function createTransportFailureResolver(dfd, log){

        return function(response){

            log('transport failed ', response);
            dfd.reject(createErrorEvent(response && response.error));
        };
    }

    function validateObject(object, spec){}

    return Chat;
}

