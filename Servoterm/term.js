var connid;
var connected = false;
var path;

function convertArrayBufferToString(buf){
  var bufView = new Uint8Array(buf);
  var encodedString = String.fromCharCode.apply(null, bufView);
  var str = decodeURIComponent(encodedString);
  str = str.replace(/(?:\r\n|\r|\n)/g, '<br />');
  return str;
}

function convertStringToArrayBuffer(str) {
  var buf=new ArrayBuffer(str.length);
  var bufView=new Uint8Array(buf);
  for (var i=0; i<str.length; i++) {
    bufView[i]=str.charCodeAt(i);
  }
  return buf;
}

function out(txt){
   var out = document.getElementById("out");
   out.innerHTML = out.innerHTML + txt;
   out.scrollTop = out.scrollHeight;
}

function sendcb(info){
   //out("send " + info.bytesSent + " bytes");
   //out("error: " + info.error);
}

function keypress(e) {
   if (e.keyCode == 13) {
      var cmd = document.getElementById("command");
      //out(cmd.value);
      //out(connid);
      chrome.serial.send(connid, convertStringToArrayBuffer(cmd.value + '\n'), sendcb);
      cmd.value = '';
      return false;
   }
}

function receive(info){
   //out("receive");
   var str = convertArrayBufferToString(info.data);
   out(str);
}

function connected_cb(connectionInfo){
   out("connected<br/>");
   connid = connectionInfo.connectionId;
	connected = true;
   // out(connectionInfo.connectionId + "<br />");
	document.getElementById('connectbutton').innerHTML = "Disconnect";
};

function getdevs(devices){
   for (var i = 0; i < devices.length; i++) {
      if(devices[i].displayName && devices[i].displayName.indexOf("STMBL") > -1){
			path = devices[i].path;
         out("Connecting to " + devices[i].path + "<br/>");
         chrome.serial.connect(devices[i].path, connected_cb);
         return;
      }
      //out(devices[i].path + ' ' + devices[i].displayName + ' ' + devices[i].vendorId + ' ' + devices[i].productId + "<br/>");
   }
	out("not found<br/>");
}

function connect(){
	chrome.serial.getDevices(getdevs);
	document.getElementById('command').focus();
}

function disconnected_cb(){
	out("disconnected<br/>");
}

function disconnect(){
	chrome.serial.disconnect(connid,disconnected_cb);
	document.getElementById('connectbutton').innerHTML = "Connect";
	connected = false;
}

function onconnect(e){
	if(connected){
		disconnect();
	}
	else{
		connect();
	}
}

document.addEventListener('DOMContentLoaded', function () {
	

	var pstyle = 'background-color: #F5F6F7; border: 1px solid #dfdfdf; padding: 5px;';
	$('#layout').w2layout({
		name: 'layout',
		panels: [
			{ type: 'top',  size: 50, resizable: false, style: pstyle, content: '<a href="" id="connectbutton">Connect</a>' },
			// { type: 'left', size: 200, resizable: true, style: pstyle, content: 'left' },
			{ type: 'main', style: pstyle, content: 'main' },
			{ type: 'preview', size: '50%', resizable: true, style: pstyle, content: '<div id="out" style="overflow-y:scroll; overflow-x:hidden; height:100%;"></div>' },
			// { type: 'right', size: 200, resizable: true, style: pstyle, content: 'right' },
			{ type: 'bottom', size: 50, resizable: false, style: pstyle, content: '<input type="text" id="command" class="heighttext" name="command" autocomplete="off" spellcheck="false" autofocus>' }
		]
	});

	chrome.serial.onReceive.addListener(receive);
   document.getElementById('command').addEventListener("keypress", keypress);
   document.getElementById('connectbutton').addEventListener("click", onconnect);
});
