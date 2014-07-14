function Transport_REST_WebAPI(oOptions){
    'use strict';

    if(!oOptions || (oOptions && !oOptions.id))return false;

    var oThis = this,
        Deferred = $.Deferred,
        ChatURI = oOptions.dataURL,
        
        iTenantID = oOptions.id,
        iChatID = "",
        iUserID = "",
        iSecureKey = "",
        iAliasID = "",
        iTranscriptPosition = 1,
        iLastTranscriptPosition = 1,
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
            bIsTyping = false,
            bIsNotice = false;

        switch(data.type){

            case "Message":             data.type = "MessageReceived";                          break;
            case "ParticipantJoined":   data.type = "AgentConnected";                           break;
            case "ParticipantLeft":     data.type = "AgentDisconnected";                        break;
            case "ParticipantRejoined": data.type = "ParticipantRejoined";                      break;
            case "TypingStarted":       data.type = "AgentTyping";          bIsTyping = true;   break;
            case "TypingStopped":       data.type = "AgentTyping";          bIsTyping = false;  break;
            case "TranscriptSaveDone":  data.type = "TranscriptSaveDone";                       break;
            case "Notice":              data.type = "MessageReceived";      bIsNotice = true;   break;
        }

        if(data.from && data.from.type){

	        switch(data.from.type){

	            case "Client":          data.from.type = "Client";               break;
	            case "Agent":           data.from.type = "Agent";                break;
	            case "External":        data.from.type = "External";             break;
	        }
	    }

        out.type = data.type;
        out.index = data.index;
        out.timestamp = new Date().getTime();
        out.isTyping = (data.type === "AgentTyping")?bIsTyping:undefined;
        out.content = (data.text)?{text: data.text, type:(bIsNotice)?"notice":"text"}:undefined;
        out.party = {

            id: (data.from)?parseInt(data.from.participantId):"",
            type: (data.from)?data.from.type:"",
            name: (data.from)?data.from.nickname:""
        };

        if(data.index >= 0 && data.index >= iTranscriptPosition){

            iTranscriptPosition = data.index + 1;
        }

        console.log("Received Index: "+out.index+",  Type: "+out.type+",  Content: "+data.text);

        if(data.alias){

            iAliasID = data.alias;
        }

        return out;
    }


    function parseTranscript(transcript){

        $.each(transcript.messages, function(){
            
            var entry = transformJSON(this);
            
            if(entry.type == "AgentConnected" && entry.party.type == "External"){

                return false;
            }

            if(callbacks[entry.type]){
            	
                callbacks[entry.type](entry);
            }

            if(entry.type == "AgentDisconnected" && entry.party.type == "Client"){

                oThis.stopPoll();
            }
        });
    }


    function request(suffix, type, params){

        var dfd = new Deferred();
           
        $.ajax({

	        url: ChatURI + iChatID + (suffix||""),
	        type: type,
	        crossDomain: true,
	        data: JSON.stringify(params, undefined, 2),

	        headers: {

	        	'Content-Type': 'application/json'
	        },
	        
	        xhrFields: {

	        	withCredentials: true
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

	            //if(contactCenterId)xhr.setRequestHeader('ContactCenterId', "515a4376-ac30-4ed2-801f-a876c0d56c93");
	        }
	    });
 
        return getPromise(dfd);
    }










    this.init = function(){

    	console.log("RESTTransport.init()");

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
		
		console.log("RESTTransport.startPoll()");

    	window.poll_int = setInterval(

            function(){

                oThis.poll();
            }, 

            iPollInterval_ms
        );

        this.poll();
    };

    this.stopPoll = function(){
    	
    	console.log("RESTTransport.stopPoll()");

    	clearInterval(window.poll_int);
    };

    this.startSession = function(options){
    	
    	console.log("RESTTransport.startSession()");

        return request("", "POST", {

            tenantId:       iTenantID,
            nickname:       oOptions.formData.nickname||"Anonymous",
            firstName:      oOptions.formData.firstname||"John",
            lastName:       oOptions.formData.lastname||"Doe",
            emailAddress:   oOptions.formData.email||"",
            subject:        oOptions.formData.subject||"No Subject",
            text: "",
            userData: oOptions.userData||{}
        
        }).done(function(response){

        	if(response.statusCode == 0){

        		iChatID = response.chatId;
                iSecureKey = response.secureKey;
                iAliasID = response.alias;
                iUserID = response.userId;
        	}

        	oThis.startPoll();
        });
    };

    this.sendMessage = function(params){

    	console.log("RESTTransport.sendMessage()");

        return request("", "POST", {

            tenantId: iTenantID,
            operationName: "SendMessage",
            text: params.message,
            userId: iUserID,
            secureKey: iSecureKey,
            alias: iAliasID
        });
    };

    this.getTranscript = function(options){

        console.log("Requesting Index: "+iTranscriptPosition);

        return request(

            "/messages",
            "POST",
            {
                tenantId: iTenantID,
                secureKey: iSecureKey,
                alias: iAliasID,
                userId: iUserID,
                transcriptPosition: iTranscriptPosition
            }
        );
    };

    this.getChat = function(options){

    	console.log("RESTTransport.getChat()");

        return request(

            "", 
            "GET",
            {
                tenantId: iTenantID,
                secureKey: iSecureKey,
                alias: iAliasID,
                userId: iUserID
            }
        );
    };

    this.leaveSession = function(options){

    	console.log("RESTTransport.leaveSession()");

    	this.stopPoll();

        return request(

            "",
            "POST", 
            {
                tenantId: iTenantID,
                operationName: "Complete",
                alias: iAliasID,
                secureKey: iSecureKey,
                userId: iUserID
            }
        );
    };

    this.sendTyping = function(options){
        
        var options = options||{};

        if(options.isTyping){
        	console.log("typing started");
        	return request(

	        	"",
	        	"POST",
	        	{
                    tenantId: iTenantID,
                    operationName: "SendStartTypingNotification",
                    alias: iAliasID,
                    secureKey: iSecureKey,
                    userId: iUserID
                }
	        );

        }else{
        	console.log("typing stopped");

        	return request(

	        	"",
	        	"POST",
	        	{
                    tenantId: iTenantID,
                    operationName: "SendStopTypingNotification",
                    alias: iAliasID,
                    secureKey: iSecureKey,
                    userId: iUserID
                }
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