'use strict';
angular.module('gMaps', [])
.directive('gmaps', function($window, $timeout) {
	return {
		restrict: 'E',
		replace: true,
		template: '<div class="gmaps"></div>',
		scope: {
			userLocation: '=', // { lat: 10, lng: 10 }
			markers: '=', // Array of map markers [{ lat: 10, lon: 10, name: 'hello' }]
			zoom: '=', // zoom level
			panControl: '@', // Whether to show a pan control on the map.
			zoomControl: '@', // Whether to show a zoom control on the map.
			scaleControl: '@', // Whether to show scale control on the map.
			callbackfunction: '=callbackdata', //callback function(){ return clicked obj}
			markersUid: '=' // unique Id to add remove items
		},
		link: function(scope, element, attrs) {
			var map, currentMarkers, initMap, google;
			var uid = scope.markersUid || 'id';

			scope.$watch('markers', function(oldValue, newValue) {
				if(oldValue != newValue)
					updateMarkers();
			});

			scope.$watch('userLocation', function(oldValue, newValue){
				if(oldValue != newValue)
					updateUserLocation();
			});


			function createMap() {
				var mapOptions = {
					zoom: scope.zoom || 14,
					center: new google.maps.LatLng(scope.userLocation.lat, scope.userLocation.lng),
					mapTypeId: google.maps.MapTypeId.ROADMAP,
					zoomControl: true,
					scaleControl: false,
					streetViewControl: false,
					navigationControl: true,
					disableDefaultUI: true,
					overviewMapControl: true
				};
				if (!(map instanceof google.maps.Map)) {
					map = new google.maps.Map(element[0], mapOptions);
				}
				updateMarkers();
				updateUserLocation();
			}

			function evaluate(){
				console.log('scope.userLocation:', scope.userLocation);
				if(scope.userLocation && scope.userLocation.lat){
					console.log(scope.userLocation);
					createMap();
				}
				else{
					$timeout(function(){
						evaluate();
					}, 300);
				} 
			}

			// callback when google maps is loaded
			$window.initMap = function() {
				google = window.google;
				console.log('map: init callback', google);
				evaluate();
			};
			console.log(scope.userLocation);

			function loadGMaps() {
				console.log('map: start loading js gmaps');
				var script = $window.document.createElement('script');
				script.type = 'text/javascript';
				script.src = 'https://maps.google.com/maps/api/js?key=TOKEN&callback=initMap';
				$window.document.body.appendChild(script);
			}

			if (!$window.google || !$window.google.maps) {
				loadGMaps();
			} else {
				google = window.google;
				evaluate();
			}
			
			// call back function - Marker click
			function onItemClick(obj) {
				return function() {
					scope.callbackfunction(obj);
				}
			}

			// Object declaration, if not declared will fail with es5 using Object.keys
			currentMarkers = {};

			// update map markers to match scope marker collection
			function updateMarkers() {
				console.log(scope.markers);
				if (map && scope.markers) {
					var currentKeys = Object.keys(currentMarkers);
					// create new markers
					
					var markers = scope.markers;
					// evaluate bindings exparession 
					if (angular.isString(markers)) {
						markers = scope.$eval(scope.markers);
					}
					// if no markers - remove all existing
					if(!markers.length && currentKeys.length){
						deleteAllMarkers(currentKeys);
						return;
					}
					
					// remove marker
					for(var i = 0; i < currentKeys; i++){
						if(!searchInArrayOfMarkers(currentKeys[i])){
							removeMarker(currentKeys[i]);
						}
					}

					// add new markers
					for (var i = 0; i < markers.length; i++) {
						if(!searchInArray(currentKeys, markers[i])){
							var loc = new google.maps.LatLng(markers[i].lat, markers[i].lng);
							var m = new google.maps.Marker({
								position: loc,
								map: map,
								animation: google.maps.Animation.DROP,
								icon: 'IMAGE.png'
							});

							// google.maps.event.addListener(m, 'click', onItemClick(m, markers[i]));
							m.addListener('click', onItemClick(markers[i]));
							currentMarkers[markers[i][uid]] = m;
						}
					}
				}
			}

			//search in array of Markers
			function searchInArrayOfMarkers(target){
				for(var i = 0; i < scope.markers.length; i++){
			    	if( scope.markers[i][uid] === target){
			      		return true;
			    	}
			  	}
			  	return false; 
			}

			//search in array of Markers
			function searchInArray(array, target){
				for(var i = 0; i < array.length; i++){
			    	if(array[i] === target){
			      		return true;
			    	}
			  	}
			  	return false; 
			}

			// Deletes all markers in the array by removing references to them.
			function deleteAllMarkers(currentKeys) {
				for (var i = 0; i < currentKeys.length; i++) {
		          currentMarkers[i].setMap(null);
		        }
				currentMarkers = {};
			}
			
			// Delete single marker
			function removeMarker(id){
				currentMarkers[id].setMap(null);
				delete currentMarkers.id;
			}

			function updateUserLocation(){
				if (map && scope.userLocation) {
					var loc = new google.maps.LatLng(scope.userLocation);
					var mm = new google.maps.Marker({
						position: loc,
						map: map,
						icon: 'IMAGE.png'
					});
				}
			}

		}
	}
});
