var args = arguments[0] || {};
var loading = Alloy.createController("loading");
var data;
var anchor = COMMON.now();
var last_update = COMMON.now();
var start = 0;

function navTo(e){
	console.log('start from here');
	console.log(e.source);
	params = e.source.records;
	console.log(params);
	Alloy.Globals.Navigator.open("chatroom", params);
}

function doLogout(){
	var user = require("user");
	user.logout(function(){
		var win = Alloy.createController("auth/login").getView();
    	win.open();
    	Alloy.Globals.Navigator.navGroup.close();
	});
}

function getPreviousData(param){
	var model = Alloy.createCollection("room");
	data = model.getUserData();
	console.log(data);
}

function render_list(){
	var setData = [];
	for (var i=0; i < data.length; i++) {
		var message = data[i].message;
		if (message.substr(0,4)=="http") {
			message = "voice record";
		}else{
			message = data[i].message;
		};
		var row = $.UI.create("TableViewRow", {records: data[i], backgroundColor:"#a02532", color: "transparent", title: data[i].sender_name+" "+data[i].patient_name+" "+message});
		var view_main = $.UI.create("View", {touchEnabled:false, classes:['wfill','hsize','horz']});
		var view_left = $.UI.create("View", {touchEnabled:false, classes:['hsize','padding','vert'], width: "60%"});
		var label_user = $.UI.create("Label", {touchEnabled:false, classes:['wfill','hsize','h5'], text: data[i].patient_name+" "+data[i].unread});
		var label_last_user = $.UI.create("Label", {touchEnabled:false, classes:['wfill','hsize','h5'], text: data[i].sender_name});
		
		
		var label_last_message = $.UI.create("Label", {touchEnabled:false, classes:['wfill','hsize','h6'], text: message});
		var view_right = $.UI.create("View", {touchEnabled:false, classes:['wfill','hsize','padding']});
		var label_time = $.UI.create("Label", {touchEnabled:false, classes:['wsize','hsize','h6'], textAlign: "right", right:0, text: data[i].created});
		
		view_left.add(label_user);
		view_left.add(label_last_message);
		view_main.add(view_left);
		view_right.add(label_time);
		view_main.add(view_right);
		row.add(view_main);
		setData.push(row);
	};
	$.tbl.setData(setData);
}

function refresh(){
	loading.start();
	var checker = Alloy.createCollection('updateChecker'); 
	var dr_id = Ti.App.Properties.getString('dr_id') || 0;
	var isUpdate = checker.getCheckerById(0, dr_id);
	var last_updated = isUpdate.updated || "";
	last_update = last_updated;
	console.log({dr_id: dr_id, last_updated: last_updated, is_doctor: 1});
	API.callByPost({url:"getMessage", params: {dr_id: dr_id, last_updated: last_updated, is_doctor: 1}}, 
		{onload: function(responseText){
			var model = Alloy.createCollection("room");
			var res = JSON.parse(responseText);
			var arr = res.data || undefined;
			if(res.status == "success"){
				console.log(res.last_updated+" res.last_updated");
				model.saveArray(arr);
				checker.updateModule(0, "getMessage", res.last_updated, dr_id);
				getPreviousData();
				render_list();
			}else{
				alert(res.data);
			}
			loading.finish();
		}
	});
}

function popMore(){
	var dialog = Ti.UI.createOptionDialog({
	  cancel: 3,
	  options: ['Logout', 'Cancel'],
	  title: 'More'
	});
		
	dialog.show(); 
	dialog.addEventListener("click", function(e){   
		if(e.index == 0){
			doLogout();
		}
	});
	dialog=null;
}

function init(){
	console.log("init");
	
	socket.addEventListener("doctor:refresh_patient_list", refresh);
	socket.addEventListener("controller:getDoctorList", onDuty);
	PUSH.registerPush();
	$.win.add(loading.getView());
	var AppVersionControl = require('AppVersionControl');
	$.doctor_name.text = Ti.App.Properties.getString('name');
	
	//AppVersionControl.checkAndUpdate();
}

init();

function onDuty(e){
	var online_doctor = e.name_list;
	var dr_id = Ti.App.Properties.getString('dr_id') || 0;
	var status = false;
	for (var i=0; i < online_doctor.length; i++) {
		if(online_doctor[i].dr_id == dr_id){
			status = true;
		}
	};
	$.onDuty.value = status;
}

function update_online_status(e){
	var name = Ti.App.Properties.getString('name');
	var dr_id = Ti.App.Properties.getString('dr_id') || 0;
	if(e.value){
		Ti.App.fireEvent("socket:join_special_room", {name: name, dr_id: dr_id});
	}else{
		Ti.App.fireEvent("socket:leave_special_room", {name: name, dr_id: dr_id});
	}
	var device_token = Ti.App.Properties.getString('deviceToken');
	var u_id = Ti.App.Properties.getString('dr_id');
	API.callByPost({url: "updateDoctorDeviceToken", params: {u_id: u_id, device_id: device_token}}, {onload: function(res){console.log(res);}});
}

function socket_loaded(){
	var name = Ti.App.Properties.getString('name');
	var dr_id = Ti.App.Properties.getString('dr_id') || 0;
	Ti.App.fireEvent("socket:getDoctorList", {name: name, dr_id: dr_id});
}

Ti.App.addEventListener('socket_loaded', socket_loaded);
Ti.App.addEventListener('home:refresh',refresh);

$.win.addEventListener("close", function(){
	socket.removeEventListener("doctor:getDoctorList");
	socket.removeEventListener("doctor:refresh_patient_list");
	/*Ti.App.removeEventListener('home:refresh',refresh);
	Ti.App.removeEventListener('home:init',init);*/
	$.destroy();
});
