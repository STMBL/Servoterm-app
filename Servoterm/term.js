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

function println(str){
	out('<font color="FireBrick">' + str + '</font><br/>')
}

function sendcb(info){
   //println("send " + info.bytesSent + " bytes");
   //println("error: " + info.error);
}

function keypress(e) {
   if (e.keyCode == 13) {
      var cmd = document.getElementById("command");
      //println(cmd.value);
      //println(connid);
      chrome.serial.send(connid, convertStringToArrayBuffer(cmd.value + '\n'), sendcb);
      cmd.value = '';
      return false;
   }
}

function receive(info){
   //println("receive");
   var str = convertArrayBufferToString(info.data);
   out(str);
}

function connected_cb(connectionInfo){
   out("connected<br/>");
   connid = connectionInfo.connectionId;
	connected = true;
   // println(connectionInfo.connectionId);
	document.getElementById('connectbutton').innerHTML = "Disconnect";
};

function getdevs(devices){
   for (var i = 0; i < devices.length; i++) {
      if(devices[i].displayName && devices[i].displayName.indexOf("STMBL") > -1){
			path = devices[i].path;
         println("Connecting to " + devices[i].path);
         chrome.serial.connect(devices[i].path, connected_cb);
         return;
      }
      //println(devices[i].path + ' ' + devices[i].displayName + ' ' + devices[i].vendorId + ' ' + devices[i].productId );
   }
	println('not found');
}

function connect(){
	chrome.serial.getDevices(getdevs);
	document.getElementById('command').focus();
}

function disconnected_cb(){
	println('disconnected');
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

function resize(){
	// console.log("resize");
   
   //console.log(window.devicePixelRatio);
   
	var canvas = document.getElementById('wavecanvas');
   var pixel = 1;
   canvas.style.width='100%';
   canvas.style.height='100%';
   canvas.width  = canvas.offsetWidth;
   canvas.height = canvas.offsetHeight;
   
   //HiDPI display support
   if(window.devicePixelRatio){
      pixel = window.devicePixelRatio;
      var height = canvas.getAttribute('height');
      var width = canvas.getAttribute('width');
      // reset the canvas width and height with window.devicePixelRatio applied
      canvas.setAttribute('width', Math.round(width * window.devicePixelRatio));
      canvas.setAttribute('height', Math.round( height * window.devicePixelRatio));
      // force the canvas back to the original size using css
      canvas.style.width = width+"px";
      canvas.style.height = height+"px";
   }
   
   var x_res = canvas.width;
   var y_res = canvas.height;
   
	var ctx = canvas.getContext('2d');
	ctx.beginPath();
   ctx.lineWidth = pixel;
	
	//cross
   ctx.moveTo(0,0);
   ctx.lineTo(x_res, y_res);
   ctx.moveTo(x_res,0);
   ctx.lineTo(0, y_res);
	
	//outline
   ctx.moveTo(0,y_res);
   ctx.lineTo(x_res, y_res);
	
   ctx.moveTo(0,0);
   ctx.lineTo(x_res, 0);
	
   ctx.moveTo(x_res, 0);
   ctx.lineTo(x_res, y_res);
	
   ctx.moveTo(0, 0);
   ctx.lineTo(0, y_res);
	
	//centerline
   ctx.moveTo(0, y_res/2);
   ctx.lineTo(x_res, y_res/2);
	
   ctx.stroke();
}

document.addEventListener('DOMContentLoaded', function () {

	var pstyle = 'background-color: #F5F6F7; border: 1px solid #dfdfdf; padding: 5px;';
	$('#layout').w2layout({
		name: 'layout',
		panels: [
			{ type: 'top',  size: 30, resizable: false, style: pstyle, content: '<a href="" id="connectbutton">Connect</a>' },
			{ type: 'main', style: pstyle, content: '<canvas id="wavecanvas"></canvas>' },
			{ type: 'preview'	, size: '50%', resizable: true, style: pstyle, content: '<div class="output" id="out"></div>' },
			{ type: 'bottom', size: 37, resizable: false, style: pstyle, content: '<input type="text" id="command" class="heighttext" name="command" autocomplete="off" spellcheck="false" autofocus>' }
		]  
	});
	
	w2ui['layout'].on({ type : 'resize', execute : 'after'}, function (target, eventData) {
		resize();
	});
	
	chrome.serial.onReceive.addListener(receive);
   document.getElementById('command').addEventListener("keypress", keypress);
   document.getElementById('connectbutton').addEventListener("click", onconnect);
});
