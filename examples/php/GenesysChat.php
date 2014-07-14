<?php
class GenesysChat
{
    var $host = '';
    var $id = '';
    var $chatUri = '';
    var $apiKey = '';
    var $context = '';
    var $URI_CONTEXT = '';
    
    private function executeRequest($url, $request, $method = 'POST') {
        
        print ">>> Request ({$url}):\n";
        print ">>> " . json_encode($request, JSON_FORCE_OBJECT) . "\n";
        
        $curl = curl_init();
        curl_setopt($curl, CURLOPT_URL, $url);
        curl_setopt($curl, CURLOPT_VERBOSE, false);
        curl_setopt($curl, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($curl, CURLOPT_CUSTOMREQUEST, $method);
        curl_setopt($curl, CURLOPT_POSTFIELDS, json_encode($request, JSON_FORCE_OBJECT));
        curl_setopt($curl, CURLOPT_HTTPHEADER, array('Content-Type: application/json', 'apikey: ' . $this->apiKey));
        curl_setopt($curl, CURLOPT_TIMEOUT, 30);
        
        $response = curl_exec($curl);
        
        if (curl_errno($curl)) {
            print "An error was returned from the server: " . curl_error($curl);
            throw new Exception(curl_error($curl));
        }
        
        print "<<< Response:\n";
        print "<<< {$response}\n";
        print "~~~~~~~~~~~~~~~~~\n";
        
        curl_close($curl);
        return json_decode($response);
    }
    
    function __construct($host, $context, $apiKey, $nickname, $subject = '') {
        
        $this->host = $host;
        $this->context = $context;
        $this->apiKey = $apiKey;
        $this->URI_CONTEXT = '/' . $this->context . '/v2/chats';

        $request = $this->constructRequestArray('RequestChat', array('nickname' => $nickname, 'subject' => $subject));
        $response = $this->executeRequest($this->host . $this->URI_CONTEXT, $request);
        
        if (!empty($response->statusCode) || 0 !== $response->statusCode) {
            throw new Exception('Unable to create a new chat session');
        }
        
        // don't use the URI returned by the response
        // $this->chatUri = $response->uri;
        $this->id = $response->id;

        $this->chatUri = $this->host . $this->URI_CONTEXT . "/{$this->id}";
    }
    
    function sendMessage($text) {
        $request = $this->constructRequestArray('SendMessage', array('text' => $text));
        return $this->executeRequest($this->chatUri, $request);
    }
    
    function sendStartTypingNotification() {
        $request = $this->constructRequestArray('SendStartTypingNotification');
        return $this->executeRequest($this->chatUri, $request);
    }
    
    function sendStopTypingNotification() {
        $request = $this->constructRequestArray('SendStopTypingNotification');
        return $this->executeRequest($this->chatUri, $request);
    }
    
    function completeSession() {
        $request = $this->constructRequestArray('Complete');
        return $this->executeRequest($this->chatUri, $request);
    }
    
    private function constructRequestArray($operation, $pairs = array()) {
        $request = array('operationName' => $operation);
        foreach ($pairs as $key => $value) {
            $request[$key] = $value;
        }
        return $request;
    }
}
