'use strict';

var isChannelReady;
var isInitiator = false;
var isStarted = false;
var localStream;
var peerConn;
var remoteStream;
var toid;
var myid;
var firstStream;

var configuration = {'iceServers': [{"url": "stun:webrtc.vidao.com:3478"}, {"url":"turn:webrtc@webrtc.vidao.com:3478", "credential":"therobot"}]};

var sdpConstraints = {'mandatory': {
    'OfferToReceiveAudio':true,
    'OfferToReceiveVideo':true }};

var localVideo = document.querySelector('#localVideo');
var remoteVideo = document.querySelector('#remoteVideo');
//////////////////////////////////////////////////////////////////////////////

var socket = io.connect();

function startConnection() {
    var username = document.getElementById("username").value;
    if (username === '') {
        username = prompt('Enter username:');
    }
    console.log("Username", username);
    var outElem = document.createElement('p');
    outElem.innerHTML = username;
    var result = document.getElementById('usernameResult');
    result.appendChild(outElem);
    socket.emit('username', username);
    myid = username;
}

function getusermedia() {
    var constraints = {audio: true, video: true};
    getUserMedia(constraints, handleUserMedia, handleUserMediaError);
    console.log('Getting user media with constraints', constraints);
}
function connect() {
    socket.emit('connectToNext');
}

//socket.on('created', function (room, clientId) {
//    console.log('Created room', room, '- my client ID is', clientId);
//    isInitiator = true;
//});

socket.on('init', function (initiator,to) {
    console.log("initiator",initiator);
    toid = to;
    isInitiator = initiator;
});

//socket.on('joined', function (room, clientId) {
//    console.log('This peer has joined room', room, 'with client ID', clientId);
//    isInitiator = false;
//});

socket.on('ready', function () {
    isChannelReady = true;
    maybeStart();
    //createPeerConnection(isInitiator,configuration);
    //createDataChannel(isInitiator)
});

socket.on('log', function (array) {
    console.log.apply(console, array);
});

socket.on('message', function (message) {
    console.log('Client received message:', message);
    //signalingMessageCallback(message);
    if (message === 'got user media') {
        console.log('Its going to start');
        maybeStart();
    } else if (message.type === 'offer') {
        if (!isInitiator && !isStarted) {
            maybeStart();
        }
        console.log('Offer Message : ', message);
        peerConn.setRemoteDescription(new RTCSessionDescription(message));
        doAnswer();
    } else if (message.type === 'answer' && isStarted) {
        console.log('Answer Message : ', message);
        peerConn.setRemoteDescription(new RTCSessionDescription(message));
    } else if (message.type === 'candidate' && isStarted) {
        console.log('setting up candidate');
        peerConn.addIceCandidate(new RTCIceCandidate({
            candidate: message.candidate
        }));
    } else if (message === 'bye' && isStarted) {
        //handleRemoteHangup();
    } else {
        console.log('The message : ', message);
    }
});


function sendMessage(message) {
    console.log('Client sending message: ', message);
    socket.emit('message', message,toid);
}

var leftPeerConn;
var rightPeerConn;
var peerConn;
var dataChannel;
var leftDataChannel;
var rightDataChannel;

function signalingMessageCallback(message) {
    if (message.type === 'offer') {
        console.log('Got offer. Sending answer to peer.');
        peerConn.setRemoteDescription(new RTCSessionDescription(message), function () {
                console.log('successfully ste the remote desc');
                peerConn.createAnswer(onLocalSessionCreated, logError);
            },
            logError);


    } else if (message.type === 'answer') {
        console.log('Got answer.');
        peerConn.setRemoteDescription(new RTCSessionDescription(message), function () {
            },
            logError);

    } else if (message.type === 'candidate') {
        peerConn.addIceCandidate(new RTCIceCandidate({
            candidate: message.candidate
        }));

    } else if (message === 'bye') {
        // TODO: cleanup RTC connection?
    }
}

function createPeerConnection(isInitiator, config) {
	if(!peerConn){
	    console.log('Creating Peer connection as config:', config);
	 	peerConn = new RTCPeerConnection(config);
        console.log('The Created Peer Connection :: ', peerConn);
	    // send any ice candidates to the other peer
	    peerConn.onicecandidate = function (event) {
	        if (event.candidate) {
	            sendMessage({
	                type: 'candidate',
	                //label: event.candidate.sdpMLineIndex,
	                //id: event.candidate.sdpMid,
	                candidate: event.candidate.candidate
	            });
	        } else {
	            console.log('End of candidates.');
	        }
	    };

        if (!isInitiator) {
            console.log('Left Peer Conn');
            leftPeerConn = peerConn;
            leftPeerConn.onaddstream = handleRemoteStreamAdded;
        }
    }
    else{
        console.log('I am at the middle node');
    	//leftPeerConn = peerConn;
    	peerConn = undefined;
    	createPeerConnection(isInitiator,config);
    }
}

function createDataChannel(isInitiator) {
    console.log('IsInitiator', isInitiator);
    if (isInitiator) {
        console.log('Creating Data Channel');
        dataChannel = peerConn.createDataChannel('photos');
        if(leftDataChannel != undefined){
        	rightDataChannel = dataChannel;
        }
        else{
        	rightDataChannel = dataChannel;
      		leftDataChannel = undefined;
        }

        onRightDataChannelCreated(rightDataChannel);
        onLeftDataChannelCreated(leftDataChannel);


        console.log('Creating an offer');
        peerConn.createOffer(onLocalSessionCreated, logError);
    } else {
        peerConn.ondatachannel = function (event) {
            console.log('ondatachannel:', event.channel);
            dataChannel = event.channel;
            leftDataChannel = dataChannel;
            rightDataChannel = undefined;
            onLeftDataChannelCreated(leftDataChannel);
            onRightDataChannelCreated(rightDataChannel);
        };
    }
}

function onLocalSessionCreated(desc) {
    console.log('local session created:', desc);
    peerConn.setLocalDescription(desc, function () {
        console.log('sending local desc:', peerConn.localDescription);
        sendMessage(peerConn.localDescription);
    }, logError);
}

function onLeftDataChannelCreated(channel) {
	if(channel!= undefined){
		console.log('onDataChannelCreated:', channel);
	    channel.onopen = function () {
	        console.log('LEFT CHANNEL opened!!!');
	    };
	    channel.onmessage = function onmessage(event) {
	        var dataToProcess = JSON.parse(event.data);
	        if(dataToProcess.from === myid) {
	            console.log('Clean');
	        } else if (dataToProcess.broadcast) {
	            console.log(dataToProcess.from, ':', dataToProcess.message);
	            rightDataChannel.send(dataToProcess);
	        } else {
	            if(dataToProcess.to !== myid) {
	               if(rightDataChannel == undefined){
	            		console.log('Message not belongs  to this user');
	            		console.log('No other user to right side');
	            	} else{
	            		console.log('Message not belongs  to this user');
	            		rightDataChannel.send(JSON.stringify(dataToProcess));
	            	}
	            } else {
	                console.log(dataToProcess.from, ':', dataToProcess.message);
	            }
	        }
	    };
	    channel.onerror = function (error) {
	        console.log("Data Channel Error:", error);
	    };

	    channel.onclose = function () {
	        console.log("The Data Channel is Closed");
	    };
	}

}

function onRightDataChannelCreated(channel) {
    if(channel != undefined){
    	console.log('onDataChannelCreated:', channel);
	    channel.onopen = function () {
	        console.log(' RIGHT CHANNEL opened!!!');
	    };
	    channel.onmessage = function onmessage(event) {
	        var dataToProcess = JSON.parse(event.data);
	        if(dataToProcess.from === myid) {
	            console.log('Clean');
	        } else if (dataToProcess.broadcast) {
	            console.log(dataToProcess.from, ':', dataToProcess.message);
	            leftDataChannel.send(dataToProcess);
	        } else {
	            if(dataToProcess.to !== myid) {
	            	if(leftDataChannel == undefined){
	            		console.log('Message not belongs  to this user');
	            		console.log('No other user to left side');
	            	} else{
	            		console.log('Message not belongs  to this user');
	            		leftDataChannel.send(JSON.stringify(dataToProcess));
	            	}
	            } else {
	                console.log(dataToProcess.from, ':', dataToProcess.message);
	            }
	        }
	    };
	    channel.onerror = function (error) {
	        console.log("Data Channel Error:", error);
	    };

	    channel.onclose = function () {
	        console.log("The Data Channel is Closed");
	    };
    }

}

function sendText() {
    var msg = document.getElementById("msg").value;
    var to = document.getElementById('to').value;
    var dataToSend = {type: 'text', broadcast:false, message: msg, to:to, from: myid};
    dataToSend = JSON.stringify(dataToSend);
    console.log('data.send', dataToSend);
    if(leftDataChannel == undefined){
    	rightDataChannel.send(dataToSend);
    }
    else if(rightDataChannel == undefined){
    	leftDataChannel.send(dataToSend);
    }
    else{
    	rightDataChannel.send(dataToSend);
    	leftDataChannel.send(dataToSend);
    }

    console.log('Ready State', dataChannel.readyState);
}

function logError(err) {
    console.log(err.toString(), err);
}


//////////////////////////////////////Stream Functions////////////////////

function handleUserMedia(stream) {
    console.log('Adding local stream.',stream);
    localVideo.src = window.URL.createObjectURL(stream);
    localStream = stream;
    if (isInitiator) {
        maybeStart();
    }
}

function handleUserMediaError(error) {
    console.log('getUserMedia error: ', error);
}

function handleRemoteStreamAdded(event) {
    console.log('EVENT::::::', event);
    console.log('Remote stream added.');
    remoteVideo.src = window.URL.createObjectURL(event.stream);
    remoteStream = event.stream;
    //setTimeout(function(){
       // if (rightPeerConn){
           // console.log('I am passing data');
           // peerConn.addStream(remoteStream);
           // doCall();
       // }
    //},1000);

}

function maybeStart() {
    console.log("Into MaybeStart()");
    //if (!isStarted && isChannelReady) {
        console.log('Two people in room, So connection is started');
        createPeerConnection(isInitiator, configuration);
        console.log('local stream',localStream);
        if (isInitiator) {
            if (localStream != undefined) {
                peerConn.addStream(localStream);
            } else {
                peerConn.addStream(remoteStream)
            }
        }
        isStarted = true;
        if (isInitiator) {
            doCall();
        }
   // } else {
       // console.log('Not enough people');
   // }
}


function addstream() {
    console.log('Broadcasting');
    //peerConn.addStream(localStream);
    doCall();
}

function handleCreateOfferError(event) {
    console.log('createOffer() error: ', e);
}

function doCall() {
    console.log('Sending offer to peer');
    peerConn.createOffer(setLocalAndSendMessage, handleCreateOfferError);
}

function doAnswer() {
    console.log('Sending answer to peer.');
    peerConn.createAnswer(setLocalAndSendMessage, null, sdpConstraints);
}

function setLocalAndSendMessage(sessionDescription) {
    peerConn.setLocalDescription(sessionDescription);
    console.log('setLocalAndSendMessage sending message', sessionDescription);
    sendMessage(sessionDescription, toid);
}