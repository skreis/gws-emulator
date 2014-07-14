<?php
include_once ('GenesysChat.php');

print "Creating a new session...\n";

$session = new GenesysChat('http://127.0.0.1:8888', 'api', 'N18TFGbKpn0zaGLXDFZhPWpTcB2eyx44', 'JohnDoe', 'HelloWorld!');
$session->sendStartTypingNotification();
$session->sendMessage("Hello World!");
$session->sendStopTypingNotification();
$session->completeSession();
