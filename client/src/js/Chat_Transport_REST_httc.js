function Transport_REST_HTTC(oOptions){
    'use strict';

    if(!oOptions || (oOptions && !oOptions.id))return false;

    var Deferred = $.Deferred,
        ChatURI = oOptions.dataURL,
        contactCenterId = oOptions.id,
        ChatID = "",
        log = console.log,
        TIMEZONE_OFFSET = (new Date()).getTimezoneOffset(),
        initDfd = new Deferred(),
        callbacks = {},
		bPolling = false,
		iPollInterval_ms = 3000,
		bFirstPoll = true;


    function getPromise(deferred){

        var promise = deferred.promise();

        return {

            done: promise.done,
            fail: promise.fail
        };
    }

    function defer(callback){

        return setTimeout(callback, 0);
    }

    function validateInitialization(){

        if(initDfd.state() !== 'resolved'){

            throw new Error('Cannot execute. Transport initialization is ' + initDfd.state());
        }
    }

    function transformJSON(data){

        var out = {},
            bIsTyping = false;

        switch(data.type){

            case "Text":                data.type = "MessageReceived";                          break;
            case "ParticipantJoined":   data.type = "AgentConnected";                           break;
            case "ParticipantLeft":     data.type = "AgentDisconnected";                        break;
            case "ParticipantRejoined": data.type = "ParticipantRejoined";                      break;
            case "TypingStarted":       data.type = "AgentTyping";          bIsTyping = true;   break;
            case "TypingStopped":       data.type = "AgentTyping";          bIsTyping = false;  break;
            case "TranscriptSaveDone":  data.type = "TranscriptSaveDone";                       break;
            case "Notice":              data.type = "Notice";                                   break;
        }

        if(data.from && data.from.type){

	        switch(data.from.type){

	            case "Customer":            data.from.type = "Client";               break;
	            case "Agent":               data.from.type = "Agent";                break;
	            case "External":            data.from.type = "External";             break;
	        }
	    }

        out.type = data.type;
        out.index = data.index;
        out.timestamp = new Date().getTime();
        out.isTyping = (data.type === "AgentTyping")?bIsTyping:undefined;
        out.content = (data.text)?{text: data.text, type:"text"}:undefined;
        out.party = {

            id: (data.from)?parseInt(data.from.participantId):"",
            type: (data.from)?data.from.type:"",
            name: (data.from)?data.from.nickname:""
        };

        return out;
    }


    function parseTranscript(transcript){

        $.each(transcript.messages, function(){

            var entry = transformJSON(this);
            console.log(entry)
            if(callbacks[entry.type]){

                callbacks[entry.type](entry);
            }
        });
    }


    function request(suffix, type, params){

        var dfd = new Deferred();

        $.ajax({

	        url: ChatURI + ChatID + (suffix||""),
	        type: type,
	        crossDomain: true,
	        data: JSON.stringify(params, undefined, 2),

	        headers: {

	        	'Content-Type': 'application/json'
	        },

	        xhrFields: {

	        	withCredentials: false
	        },

	        success: function(response){

	        	if(response.id){

	        		response.sessionId = response.id;
	        	}

	        	dfd.resolve(response || {});
	        },
	        error: function(response){

	        	dfd.reject(response || {});
	    	},
	    	beforeSend: function(xhr){

	            xhr.setRequestHeader('apikey', 'N18TFGbKpn0zaGLXDFZhPWpTcB2eyx44');
	        }
	    });

        return getPromise(dfd);
    }










    this.init = function(){

    	console.log("RESTTransport.init()")

    	defer(initDfd.resolve);

        return getPromise(initDfd);
    };

    this.poll = function(options, predefinedOptions, params){

    	if(!bPolling){

    		bPolling = true;

	        this.getTranscript().done(function(response){

        		parseTranscript(response);
        		bPolling = false;
	       });
	    }
    };

	this.startPoll = function(){

		console.log("RESTTransport.startPoll()")

		var oThis = this;

    	window.poll_int = setInterval(function(){oThis.poll();}, iPollInterval_ms);
    };

    this.stopPoll = function(){

    	console.log("RESTTransport.stopPoll()")

    	clearInterval(window.poll_int);
    };

    this.startSession = function(){

    	console.log("RESTTransport.startSession()")

    	var userData = {}

    	if(oOptions.formData.firstname || oOptions.formData.lastname || oOptions.formData.email){

			userData = {

                "FirstName":    oOptions.formData.firstname,
                "LastName":     oOptions.formData.lastname,
                "EmailAddress": oOptions.formData.email
            };
		}

    	var oThis = this;

        return request("", "POST", {

            operationName:  "RequestChat",
            nickname:       oOptions.formData.nickname||"Anonymous",
            subject:        oOptions.formData.subject||"No Subject",
			userData:       userData

        }).done(function(response){

        	if(response.id){

        		ChatID = response.id;
        	}

        	oThis.startPoll();
        });
    };

    this.sendMessage = function(params){

    	console.log("RESTTransport.sendMessage()")

        return request("", "POST", {

            operationName: "SendMessage",
            text: params.message
        });
    };

    this.getTranscript = function(options){

        return request("/messages", "GET");
    };

    this.getChat = function(options){

    	console.log("RESTTransport.getChat()")

        return request("", "GET", {});
    };

    this.leaveSession = function(options){

    	console.log("RESTTransport.leaveSession()");

    	this.stopPoll();

        return request(

            "",
            "POST",
            {operationName: "Complete"}
        );
    };

    this.sendTyping = function(options){

        var options = options||{};

        if(options.isTyping){
        	console.log("typing started")
        	return request(

	        	"",
	        	"POST",
	        	{operationName: "SendStartTypingNotification"}
	        );

        }else{
        	console.log("typing stopped")

        	return request(

	        	"",
	        	"POST",
	        	{operationName: "SendStopTypingNotification"}
	        );
        }
    };

    this.setUserData = function(options){
        //return post('SetUserData', options);
        return getPromise(new Deferred());
    };

    this.getUserData = function(options){
        //return post('GetUserData', options);
        return getPromise(new Deferred());
    };

    this.deleteUserData = function(options){
        //return post('DeleteUserData', options);
        return getPromise(new Deferred());
    };

    this.onAgentConnected = function(callback){

        callbacks.AgentConnected = callback;
    };

    this.onAgentTyping = function(callback){

        callbacks.AgentTyping = callback;
    };

    this.onAgentDisconnected = function(callback){

        callbacks.AgentDisconnected = callback;
    };

    this.onMessageReceived = function(callback){

        callbacks.MessageReceived = callback;
    };

    this.onSessionEnded = function(callback){

        callbacks.SessionEnded = callback;
    };

    this.onError = function(callback){

        callbacks.Error = callback;
    };

}