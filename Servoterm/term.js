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
var redirect_en = 0;
var redirect_buf = '';
var alpha_timeout = 0;

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
		}else if (buf[i] == 0xfe) {
			plotxpos = 0;
		}else{
			//TODO: is there a better way?
			var str = String.fromCharCode.apply(null, [buf[i]]);
         if(redirect_en == 0){
			   if(str == '\n'){
				   txt = txt + "<br />";
			   }else{
				   txt = txt + str;
			   }
         }else{
            redirect_buf = redirect_buf + str;
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
      if((devices[i].displayName && (devices[i].displayName.indexOf("STMicroelectronics") > -1 || devices[i].displayName.indexOf("STMBL") > -1)) || (devices[i].vendorId && devices[i].vendorId == 1155 && devices[i].productId && devices[i].productId == 22336)){
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
		chrome.serial.send(connid, convertStringToArrayBuffer('fault0.en = 0\n'), sendcb);
		chrome.serial.send(connid, convertStringToArrayBuffer('fault0.en = 1\n'), sendcb);
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

   if(document.getElementById('xymode').checked){
      x_res = x_res - y_res;

      ctx.beginPath();
      ctx.lineWidth = pixel;
      ctx.strokeStyle = "grey";
      ctx.arc(x_res + y_res/2, y_res/2, y_res/2*0.75, 0, 2 * Math.PI);
      ctx.stroke();

      ctx.beginPath();
      ctx.strokeStyle = "ForestGreen";
      var ypos = (value[0]*-1+1)*(y_res/2.0);
      var xpos = (value[1]*-1+1)*(y_res/2.0);
      ctx.rect(xpos+x_res, ypos, 1, 1)
      ctx.stroke()
   }
   
   ctx.clearRect(plotxpos, 0, pixel, canvas.height);
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
   ctx.clearRect(0, canvas.height, canvas.width, canvas.height);
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

   if(document.getElementById('xymode').checked){
      if(Date.now() > alpha_timeout + 50){//decay sin/cos pixels
         var imgData = ctx.getImageData(x_res, 0, canvas.height, canvas.height);
         for(var j=0;j < imgData.data.length;j+=4){
            imgData.data[j+3] = imgData.data[j+3]-1
         }
         ctx.putImageData(imgData, x_res, 0);
         alpha_timeout = Date.now()
      }
   }
}

function resize(){
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

   var x_res = canvas.width
   var y_res = canvas.height

   if(document.getElementById('xymode').checked){
      x_res = x_res - y_res;
   }

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
      chrome.serial.send(connid, convertStringToArrayBuffer("disable\n"), sendcb);
      chrome.serial.send(connid, convertStringToArrayBuffer("fault0.en = 0\n"), sendcb);
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

//read configuration
function filltext(){
   redirect_en = 0;
   var configtext = document.getElementById('configtext');
   configtext.value = redirect_buf;
   configtext.disabled = false;
   configtext.focus();
   onconfigchange();
}

// var makeCRCTable = function(){
//     var c;
//     var crcTable = [];
//     for(var n =0; n < 256; n++){
//         c = n;
//         for(var k =0; k < 8; k++){
//             c = ((c&1) ? (0x04C11DB7 ^ (c >>> 1)) : (c >>> 1));
//         }
//         crcTable[n] = c;
//     }
//     return crcTable;
// }
//
// var crc32 = function(str) {
//     var crcTable = window.crcTable || (window.crcTable = makeCRCTable());
//     var crc = 0 ^ (-1);
//
//     for (var i = 0; i < str.length; i++ ) {
//         crc = (crc >>> 8) ^ crcTable[(crc ^ str.charCodeAt(i)) & 0xFF];
//     }
//
//     return (crc ^ (-1)) >>> 0;
// };

// function crc32(s/*, polynomial = 0x04C11DB7, initialValue = 0xFFFFFFFF, finalXORValue = 0xFFFFFFFF*/) {
//   var polynomial = arguments.length < 2 ? 0x04C11DB7 : arguments[1],
//       initialValue = arguments.length < 3 ? 0xFFFFFFFF : arguments[2],
//       finalXORValue = arguments.length < 4 ? 0xFFFFFFFF : arguments[3],
//       crc = initialValue,
//       table = [], i, j, c;
//
//   function reflect(x, n) {
//     var b = 0;
//     while (n) {
//       b = b * 2 + x % 2;
//       x = Math.floor(x / 2);
//       n--;
//     }
//     return b;
//   }
//
//   for (i = 0; i < 256; i++) {
//     table[i] = reflect(i, 8) * 0x1000000;
//
//     for (j = 0; j < 8; j++) {
//       table[i] = ((table[i] * 2) ^ (((table[i] >>> 31) % 2) * polynomial)) >>> 0;
//     }
//
//     table[i] = reflect(table[i], 32);
//   }
//
//   for (i = 0; i < s.length; i++) {
//     c = s.charCodeAt(i);
//     if (c > 255) {
//       throw new RangeError();
//     }
//     j = (crc % 256) ^ c;
//     crc = ((crc / 256) ^ table[j]) >>> 0;
//   }
//
//   return (crc ^ finalXORValue) >>> 0;
// }

function onconfigchange(){
   var configmetadata = document.getElementById('configmetadata');
   var configtext = document.getElementById('configtext');
   configmetadata.innerHTML = configtext.value.length + " Bytes"; // + crc32(configtext.value).toString(16);
}

function myTimer(){
   if(connected){
      var data = txqueue.shift();
      if(data){
         chrome.serial.send(connid, convertStringToArrayBuffer(data + '\n'), sendcb);
      }
   }
}

document.addEventListener('DOMContentLoaded', function () {
  resize();
  window.addEventListener("resize", resize);
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
  
  // Get the modal
  var modal = document.getElementById('myModal');

  // Get the button that opens the modal
  var btn = document.getElementById("configbutton");
  var savebutton = document.getElementById("configsavebutton");

  // Get the <span> element that closes the modal
  var span = document.getElementsByClassName("close")[0];

  // When the user clicks on the button, open the modal 
  btn.onclick = function() {
     if(!connected){
        println("not connected");
        return
     }
     redirect_buf = '';
     redirect_en = 1;
     chrome.serial.send(connid, convertStringToArrayBuffer('showconf' + '\n'), sendcb);
     window.setTimeout(filltext, 100);
     var configtext = document.getElementById('configtext');
     configtext.addEventListener("keyup", onconfigchange);
     configtext.value = '';
     configtext.disabled = true;
     modal.style.display = "block";
  }

  savebutton.onclick = function() {
     var configtext = document.getElementById('configtext');
     var lines = configtext.value.split('\n');
     chrome.serial.send(connid, convertStringToArrayBuffer('deleteconf' + '\n'), sendcb);
     for(var line = 0; line < lines.length; line++){
        txqueue.push('appendconf ' + lines[line]);
        //println(lines[line]);
        //chrome.serial.send(connid, convertStringToArrayBuffer('appendconf ' + lines[line] + '\n'), sendcb);
     }
     txqueue.push('flashsaveconf');
     modal.style.display = "none";
     document.getElementById("command").focus();
  }

  // When the user clicks on <span> (x), close the modal
  span.onclick = function() {
     modal.style.display = "none";
     document.getElementById("command").focus();
  }

  // When the user clicks anywhere outside of the modal, close it
  window.onclick = function(event) {
     if (event.target == modal) {
        modal.style.display = "none";
     }
}
var timer = setInterval(myTimer, 50);
});
