var connid;
var connected = false;
var path;
var addr = -1;
var values = [];
var plotxpos = 0;
var plotypos = [];
var histpos = 0;
var cmdhistory = [];
var wavecolor = ["black", "red", "blue", "green", "rgb(255, 128, 0)", "rgb(128, 128, 64)", "rgb(128, 64, 128)", "rgb(64, 128, 128)"];
var pixel = 1;
var txqueue = [];
var capture_active = false;
var data = "";
var trigger_wait = true;
var trigger_lvl = 0.01;
var trigger_last = 0;
var trigger_wave = 0;
var trigger_zerocross = false;
var trigger_enabled = false;
var trigger_edge = true; //true = rising  false = falling
var trigger_buttonstate = 0; //0 disabled; 1 wait for trigger; 2 trigrd
var trigger_buttonstate_last = 0;

var uitime = setInterval(refresh_UI, 200);

function refresh_UI(){
  if(trigger_buttonstate != trigger_buttonstate_last){
    var waitbtn =  document.getElementById("waitbutton");

    if(trigger_buttonstate == 0){
      waitbtn.value = "Disabled";
      waitbtn.style.backgroundColor = "grey";
    }else if (trigger_buttonstate == 1){
      waitbtn.value = "Wait...";
      waitbtn.style.backgroundColor = "green";
    }else if (trigger_buttonstate == 2){
      waitbtn.value = "Trigrd";
      waitbtn.style.backgroundColor = "red";
    }

    trigger_buttonstate_last = trigger_buttonstate;
  }
}

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
	var cmd = document.getElementById("command");
	if(e.keyCode == 9){//tab
		e.preventDefault();
		return false;
	}
	if(e.keyCode == 38){//up
		e.preventDefault();
		if(histpos > 0 && cmdhistory.length>0){
			cmd.value = cmdhistory[--histpos];
			cmd.setSelectionRange(cmd.value.length, cmd.value.length);
		}
		return false;
	}
	if(e.keyCode == 40){//down
		e.preventDefault();
		if(histpos < cmdhistory.length - 1 && cmdhistory.length > 0){
			cmd.value = cmdhistory[++histpos];
			cmd.setSelectionRange(cmd.value.length, cmd.value.length);
		}else if(histpos < cmdhistory.length){
			histpos++;
			cmd.value = '';
		}
		return false;
	}
   if(e.keyCode == 13 && connected){//enter
		e.preventDefault();
		//if((history.size()==0 || history.back() != s) && !s.empty()){
		if((cmdhistory.length == 0 || cmdhistory[cmdhistory.length-1] != cmd.value ) && cmd.value != ''){
			cmdhistory[cmdhistory.length] = cmd.value;
		}
		histpos = cmdhistory.length;
      //println(cmd.value);
      //println(connid);
      chrome.serial.send(connid, convertStringToArrayBuffer(cmd.value + '\n'), sendcb);
      cmd.value = '';
      return false;
   }
}

function receive(info){

   var data = txqueue.shift();
   if(data){
      chrome.serial.send(connid, convertStringToArrayBuffer(data + '\n'), sendcb);
   }

	//println("receive");
	var buf = new Uint8Array(info.data);
	var txt = '';
	for (var i = 0; i < buf.length; i++) {
		if(addr >= 0){
			values[addr++] = (buf[i]-128) / 128.0;
			if(addr == 8){
        //Zerocross detection
        if(((trigger_last < 0.01 && values[trigger_wave] > 0) || (trigger_last < 0 && values[trigger_wave] > 0.01)) && !trigger_zerocross){
          trigger_zerocross = true;
        }
        trigger_last = values[trigger_wave];

        //Only plot if triggrd
        if((trigger_enabled && trigger_wait && (values[trigger_wave] >= trigger_lvl) && trigger_zerocross) || (trigger_enabled && !trigger_wait)){
          trigger_buttonstate = 2;
          trigger_wait = false;

				  plot(values);
        }else if (!trigger_enabled) {  //rolling plot if trigger is disabled
          plot(values);

        }
        addr = -1;
			}
		}else if (buf[i] == 0xff) {
			addr = 0;
		}else{
			//TODO: is there a better way?
			var str = String.fromCharCode.apply(null, [buf[i]]);
			if(str == '\n'){
				txt = txt + "<br />";
			}else{
				txt = txt + str;
			}
		}
	}
	if(txt.length > 0){//an empty string causes the view to scroll all the time
		out(txt);
	}
}

function connected_cb(connectionInfo){
	if(connectionInfo.connectionId){
   	println("connected");
   	connid = connectionInfo.connectionId;
		connected = true;
   	// println(connectionInfo.connectionId);
		document.getElementById('connectbutton').value = "Disconnect";
	}
};

function getdevs(devices){
   for (var i = 0; i < devices.length; i++) {
      if((devices[i].displayName && devices[i].displayName.indexOf("STMBL") > -1) || (devices[i].vendorId && devices[i].vendorId == 1155 && devices[i].productId && devices[i].productId == 22336)){
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

function error(info){
	println(info.error);
	disconnect();
}

function disconnect(){
	chrome.serial.disconnect(connid,disconnected_cb);
	document.getElementById('connectbutton').value = "Connect";
	connected = false;
}

function onclear(e){
   var out = document.getElementById("out");
   out.innerHTML = "";
	document.getElementById('command').focus();
}

function onreset(e){
	if(connected){
		chrome.serial.send(connid, convertStringToArrayBuffer('fault0.reset = 1\n'), sendcb);
		chrome.serial.send(connid, convertStringToArrayBuffer('fault0.reset = 0\n'), sendcb);
	}
	document.getElementById('command').focus();
}

function onexport(e){
   if(capture_active){
      capture_active = false;
      document.getElementById('exportbutton').value = "capture";
      chrome.fileSystem.chooseEntry({type: 'saveFile', suggestedName: "data.csv"}, function(writableFileEntry){
        writableFileEntry.createWriter(function(writer){
          writer.onerror = function(e){
             console.log('write error');
             data = "";
          };
          writer.onwriteend = function(e) {
             console.log('write complete');
             data = "";
          };
          writer.write(new Blob([data], {type: 'text/plain'}));
        });
      }
      );
   }
   else{
      capture_active = true;
      document.getElementById('exportbutton').value = "stop + export";
   }
}

function onconnect(e){
	if(connected){
		disconnect();
	}
	else{
		connect();
	}
}

function plot(value){
	//TODO: multiple waves
	var canvas = document.getElementById('wavecanvas');
   var x_res = canvas.width;
   var y_res = canvas.height;

	var ctx = canvas.getContext('2d');

   if(capture_active){
      for(var i = 0; i < value.length; i++){
         data += value[i] + ",";
      }
      data += "\n"
   }

	ctx.clearRect(plotxpos, 0, pixel, canvas.height);

	//var i = 0;
	for(var i = 0;i<value.length;i++){
		var ypos = (value[i]*-1+1)*(y_res/2.0);
		if(plotypos[i] && (plotypos[i] != (y_res/2.0) || values[i])){
			ctx.beginPath();
		   ctx.lineWidth = pixel;
			ctx.strokeStyle = wavecolor[i];
   		ctx.moveTo(plotxpos,plotypos[i]);
   		ctx.lineTo(plotxpos+pixel,ypos);
			ctx.stroke();
		}
		plotypos[i] = ypos;//save previous position
	}

	//centerline
	ctx.beginPath();
	ctx.lineWidth = pixel;
	ctx.strokeStyle= "grey";
   ctx.moveTo(plotxpos, y_res/2);
   ctx.lineTo(plotxpos+1, y_res/2);
	ctx.stroke();

	plotxpos+=pixel;
	if(plotxpos>=x_res){

    if(trigger_enabled){
      trigger_buttonstate = 1;
      trigger_wait = true;
      trigger_zerocross = false;
    }
		plotxpos = 0;
	}
}

function resize(){
	// console.log("resize");

   //console.log(window.devicePixelRatio);
   plotxpos = 0;
	var canvas = document.getElementById('wavecanvas');
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
	ctx.strokeStyle= "grey";
   ctx.lineWidth = pixel;

	/*
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
	*/

	//centerline
   ctx.moveTo(0, y_res/2);
   ctx.lineTo(x_res, y_res/2);

   ctx.stroke();
}

function sendfile(file){
   if(!connected){
      return;
   }
   var reader = new FileReader();
   reader.onload = function(progressEvent){
      // chrome.serial.send(connid, this.result, sendcb);
      var lines = this.result.split('\n');
      for(var line = 0; line < lines.length; line++){
            txqueue.push(lines[line]);
         }
      chrome.serial.send(connid, convertStringToArrayBuffer(txqueue.shift() + '\n'), sendcb);
   };
   reader.readAsText(file);
}

function ondrop(e){
   e.stopPropagation();
   e.preventDefault();
   if(e.dataTransfer.items.length == 1){//only one file
      sendfile(e.dataTransfer.files[0]);
   }
}

function ondragover(e){
   e.stopPropagation();
   e.preventDefault();
   e.dataTransfer.dropEffect = 'copy';
}

function onkeyup(e){
   if(!connected){
      return;
   }
   if(document.getElementById("enablejog").checked){//jogging enabled
      if(e.keyCode == 37 || e.keyCode == 39){//left
         e.preventDefault();
         chrome.serial.send(connid, convertStringToArrayBuffer("jogx\n"), sendcb);
      }
   }
}

function ontrigger(e){
   if(document.getElementById("enabletrg").checked){
     trigger_buttonstate = 1;
     trigger_enabled = true;
     trigger_wait = true;
   }else{
     trigger_enabled = false;
     trigger_buttonstate = 0;
   }

}

function onkeydown(e){
   if(!connected){
      return;
   }
   if(e.keyCode == 27){//esc
      document.getElementById("enablejog").checked = false;
      chrome.serial.send(connid, convertStringToArrayBuffer("net0.enable = 0\n"), sendcb);
      document.getElementById('command').focus();
   }else if(document.getElementById("enablejog").checked){//jogging enabled
      if(e.keyCode == 37){//left
         e.preventDefault();
         chrome.serial.send(connid, convertStringToArrayBuffer("jogl\n"), sendcb);
      }
      if(e.keyCode == 39){//right
         e.preventDefault();
         chrome.serial.send(connid, convertStringToArrayBuffer("jogr\n"), sendcb);
      }
   }
}

document.addEventListener('DOMContentLoaded', function () {

	var pstyle = 'background-color: #F5F6F7; border: 1px solid #dfdfdf; padding: 5px;';
	$('#layout').w2layout({
		name: 'layout',
		panels: [
			{ type: 'top',  size: 30, overflow: "hidden", resizable: false, style: pstyle, content: '<input type="button" id="connectbutton" value="Connect"><input type="button" id="clearbutton" value="Clear"><input type="button" id="resetbutton" value="Reset"><input type="button" id="exportbutton" value="capture"><input type="checkbox" id="enablejog">Jog</input><input type="checkbox" id="enabletrg">Trigger</input><input type="button" id="waitbutton" value="Disabled">' },
			{ type: 'main', style: pstyle, content: '<canvas id="wavecanvas"></canvas>' },
			{ type: 'preview'	, size: '50%', resizable: true, style: pstyle, content: '<div class="output" id="out"></div>' },
			{ type: 'bottom', size: 37, overflow: "hidden", resizable: false, style: pstyle, content: '<input type="text" id="command" class="heighttext" name="command" autocomplete="off" spellcheck="false" autofocus>' }
		]
	});

	w2ui['layout'].on({ type : 'resize', execute : 'after'}, function (target, eventData) {
		resize();
	});

   document.addEventListener("keydown", onkeydown);
   document.addEventListener("keyup", onkeyup);
	chrome.serial.onReceive.addListener(receive);
	chrome.serial.onReceiveError.addListener(error);
   document.getElementById('command').addEventListener("keydown", keypress);
   document.getElementById('connectbutton').addEventListener("click", onconnect);
	document.getElementById('clearbutton').addEventListener("click", onclear);
	document.getElementById('resetbutton').addEventListener("click", onreset);
   document.getElementById('exportbutton').addEventListener("click", onexport);
   document.getElementById('layout').addEventListener("drop", ondrop);
   document.getElementById('layout').addEventListener("dragover", ondragover);
   document.getElementById('enabletrg').addEventListener("click", ontrigger);
});
