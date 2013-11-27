define(function() {
	var	home = {};

	home.init = function() {

		ajaxify.register_events([
			'user.count',
			'post.stats',
			'api:user.active.get'
		]);

		socket.emit('user.count', {});
		socket.on('user.count', function(data) {
			$('#stats_users').html(utils.makeNumberHumanReadable(data.count)).attr('title', data.count);
		});

		socket.emit('post.stats');
		socket.on('post.stats', function(data) {
			$('#stats_topics').html(utils.makeNumberHumanReadable(data.topics)).attr('title', data.topics);
			$('#stats_posts').html(utils.makeNumberHumanReadable(data.posts)).attr('title', data.posts);
		});

		socket.emit('api:user.active.get');
		socket.on('api:user.active.get', function(data) {
			$('#stats_online').html(data.users);
		});
		function initialize() {

			var myLatlng = new google.maps.LatLng(37.564,126.973);
			var mapOptions = {
				center: new google.maps.LatLng(37.564,126.973),
				zoom: 19,
				mapTypeId: google.maps.MapTypeId.ROADMAP
			};
			var map = new google.maps.Map(document.getElementById("map-canvas"),
				mapOptions);
			var marker = new google.maps.Marker({
			    position: myLatlng,
			    title:"Hello World!"
			});

			// To add the marker to the map, call setMap();
			marker.setMap(map);
		}
		google.maps.event.addDomListener(window, 'load', initialize);
		google.maps.visualRefresh = true;
		
		initialize();
	}
	
	return home;
});
