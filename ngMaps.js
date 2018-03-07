/*
 * @Author: eug17
 * @Date:   2016-11-22 12:59:15
 * @Last Modified by:   Yevhen Kotliar
 * @Last Modified time: 2017-03-31 12:19:41
 */
'use strict';
var ngMaps = angular.module('ngMaps', []);
ngMaps.directive('ngmaps', ['$window', '$timeout', function($window, $timeout) {
	return {
		restrict: 'E',
		replace: true,
		template: '<div class="gmaps" style="height: 100%"></div>',
		scope: {
			userLocation: '=', // { lat: 10, lng: 10 }
			markers: '=', // Array of map markers [{ lat: 10, lon: 10, name: 'hello' }]
			zoom: '=', // zoom level
			panControl: '@', // Whether to show a pan control on the map.
			zoomControl: '@', // Whether to show a zoom control on the map.
			scaleControl: '@', // Whether to show scale control on the map.
			callbackfunction: '@', //callback function(){ return clicked obj}
			callbackboundary: '@', //callback function(){ return clicked obj}
			markersUid: '=', // unique Id to add remove items,
			userMarker: '=', // user marker
			userIcon: '=',
			markersIcon: '=',
			addPolygonItem: '=', //
			removePolygon: '=',
			polygoncallback: '@',
			drawingMode: '@',
			minZoom: '@',
			unsetUserMarker: '@',
			polygonPoints: '=',
			polygonPointsOptions: '=',
			panToPoly: '='
		},
		link: function(scope, element, attrs) {
			var map, currentMarkers, initMap, google, drawingManager, geocoder, polygonFromPoints, markerUser;
			var drawing_modes = ['polygon'];
			var drawingModeSettings = scope.drawingMode || null;
			console.log('minZoom', scope.minZoom);
			var userIcon = scope.userIcon || '';
			var markersIcon = scope.markersIcon || '';
			var uid = scope.markersUid || 'id';
			var polygonItems = [];
			var newPoly = false;
			var panToPoly = scope.panToPoly || false;

			var polygonPointsOptions = scope.polygonPointsOptions || {
				draggable: false,
				editable: false,
				strokeColor: '#FF0000',
				strokeOpacity: 0.8,
				strokeWeight: 2,
				fillColor: '#FF0000',
				fillOpacity: 0.35
			}

			scope.$watchCollection('markers', function(oldValue, newValue) {
				if (oldValue != newValue)
					updateMarkers();
			});

			scope.$watchCollection('polygonPoints', function(oldValue, newValue) {
				if (oldValue != newValue)
					updatePolygon();
			})

			scope.$watch('userLocation', function(oldValue, newValue) {
				if (oldValue != newValue)
					updateUserLocation();
			});

			var moved = false;

			function createMap() {
				var centerMap = new google.maps.LatLng(43.6425662, -79.3892455, 17);
				if (!panToPoly && scope.userLocation.lat) {
					centerMap = new google.maps.LatLng(scope.userLocation.lat, scope.userLocation.lng);
				}
				var mapOptions = {
					zoom: scope.zoom || 14,
					minZoom: scope.minZoom || 1,
					center: centerMap,
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
					window.map = map;
				}
				var centerControlDiv = document.createElement('div');
				var centerControl = new CenterControl(centerControlDiv, map);

				centerControlDiv.index = 1;

				google.maps.Polygon.prototype.getBounds = function() {
					var bounds = [];
					var length = this.getPath().getLength();
					// console.log(length);
					for (var i = 0; i < length; i++) {
						var ln = {
							lat: this.getPath().getAt(i).lat(),
							lng: this.getPath().getAt(i).lng()
						}
						bounds.push(ln);
					}
					return bounds;
				}

				if (scope.addPolygonItem) {


					drawingManager = new google.maps.drawing.DrawingManager({
						drawingMode: drawingModeSettings,
						drawingControl: true,
						drawingControlOptions: {
							position: google.maps.ControlPosition.TOP_CENTER,
							drawingModes: drawing_modes
						},
						rectangleOptions: {
							fillColor: '#0000ff',
							fillOpacity: 0.3,
							strokeWeight: 5,
							clickable: true,
							editable: true,
							draggable: true,
							zIndex: 1
						},
						polygonOptions: {
							fillColor: '#0000ff',
							fillOpacity: 0.3,
							strokeWeight: 5,
							clickable: true,
							editable: true,
							draggable: true,
							zIndex: 1
						}
					});
					drawingManager.setMap(map);

					drawingManager.addListener('polygoncomplete', polygonComplete);
					drawingManager.addListener('rectanglecomplete', polygonComplete);




				}

				map.addListener('idle', function() {
					var bounds = map.getBounds();
					var north_east = bounds.getNorthEast();
					var south_west = bounds.getSouthWest();
					var query_url = '?latlng_ne=' + north_east.lat() + ',' + north_east.lng() + '&latlng_sw=' + south_west.lat() + ',' + south_west.lng();
					if (typeof scope.callbackboundary == 'function')
						scope.callbackboundary(query_url);
				});
				map.addListener('center_changed', function() {
					if (!moved) {
						moved = true;
						map.controls[google.maps.ControlPosition.LEFT_BOTTOM].push(centerControlDiv);
					}
				});
				updateMarkers();
				if (scope.polygonPoints && scope.polygonPoints.length) {
					updatePolygon();
				}
				updateUserLocation();
				window.addEventListener('resize', function() {
					$timeout(function() {
						google.maps.event.trigger(map, 'resize');
					}, 300);
				}, true);
			}

			var polygons = [];

			function polygonDblClick() {
				polygons.length = 0;
				this.setMap(null);
				drawingManager.setOptions({
					drawingMode: null,
					drawingControlOptions: {
						position: google.maps.ControlPosition.TOP_CENTER,
						drawingModes: drawing_modes
					}
				});
			}

			// function polygonItemAdd(polygonItem){
			function polygonComplete(polygon) {
				polygon.addListener('dblclick', polygonDblClick);
				polygon.addListener('dragend', function() {
					scope.polygoncallback(polygon.getBounds());
				});
				// Add the polygon to the polygon array
				polygons.push(polygon);
				// console.log(polygons);

				// Remove the drawing controls
				drawingManager.setOptions({
					drawingMode: null,
					drawingControlOptions: {
						position: google.maps.ControlPosition.TOP_CENTER,
						drawingModes: []
					}
				});

				// Delete menu
				function DeleteMenu() {
					this.div_ = document.createElement('div');
					this.div_.className = 'delete-menu';
					this.div_.innerHTML = 'Delete';

					var menu = this;
					google.maps.event.addDomListener(this.div_, 'click', function() {
						menu.removeVertex();
					});
				}
				DeleteMenu.prototype = new google.maps.OverlayView();

				DeleteMenu.prototype.onAdd = function() {
					var deleteMenu = this;
					var map = this.getMap();
					this.getPanes().floatPane.appendChild(this.div_);
					this.divListener_ = google.maps.event.addDomListener(map.getDiv(), 'mousedown', function(e) {
						if (e.target != deleteMenu.div_) {
							deleteMenu.close();
						}
					}, true);
				};

				DeleteMenu.prototype.onRemove = function() {
					google.maps.event.removeListener(this.divListener_);
					this.div_.parentNode.removeChild(this.div_);

					// clean up
					this.set('position');
					this.set('path');
					this.set('vertex');
				};

				DeleteMenu.prototype.close = function() {
					this.setMap(null);
				};

				DeleteMenu.prototype.draw = function() {
					var position = this.get('position');
					var projection = this.getProjection();
					// console.log('position', position);
					// console.log('projection', projection);

					if (!position || !projection) {
						return;
					}

					var point = projection.fromLatLngToDivPixel(position);
					// console.log('point', point);
					this.div_.style.cursor = 'pointer';
					this.div_.style.position = 'absolute';
					this.div_.style.padding = '7px 10px';
					this.div_.style.backgroundColor = '#fff';
					this.div_.style.top = point.y + 'px';
					this.div_.style.left = point.x + 'px';
				};

				/**
				 * Opens the menu at a vertex of a given path.
				 */
				DeleteMenu.prototype.open = function(map, path, vertex) {
					// console.log('path', path.getAt(vertex));
					// console.log(vertex);
					this.set('position', path.getAt(vertex));
					this.set('path', path);
					this.set('vertex', vertex);
					this.setMap(map);
					this.draw();
				};

				/**
				 * Deletes the vertex from the path.
				 */
				DeleteMenu.prototype.removeVertex = function() {
					var path = this.get('path');
					var vertex = this.get('vertex');

					if (!path || vertex == undefined) {
						this.close();
						return;
					}

					path.removeAt(vertex);
					// console.log(polygon.getBounds());
					var polygonLength = polygon.getBounds().length;
					// console.log(polygonLength);
					polygonItems.splice(vertex, 1);
					// console.log(polygonItems);
					if (polygonLength < 3) {
						polygons.length = 0;
						polygon.setMap(null);
						drawingManager.setOptions({
							drawingMode: null,
							drawingControlOptions: {
								position: google.maps.ControlPosition.TOP_CENTER,
								drawingModes: drawing_modes
							}
						});
					}
					newPoly = true;
					this.close();
				};



				// --- End Delete Memu ---
				var deleteMenu = new DeleteMenu();
				// intial call get Bounds
				scope.polygoncallback(polygon.getBounds());

				google.maps.event.addListener(polygon, 'rightclick', function(e) {
					// console.log('e: ',e);
					if (e.vertex == undefined) {
						return;
					}
					deleteMenu.open(map, polygon.getPath(), e.vertex);
				});
				// polygon.setMap(map);
				polygon.getPaths().forEach(function(path, index) {
					google.maps.event.addListener(path, 'insert_at', function() {
						scope.polygoncallback(polygon.getBounds());
					});
					google.maps.event.addListener(path, 'remove_at', function() {
						scope.polygoncallback(polygon.getBounds());
					});
					google.maps.event.addListener(path, 'set_at', function() {
						scope.polygoncallback(polygon.getBounds());
					});

				});


				// 	return;
				// }
				// console.log(polygonItems);
				if (polygonItems && polygonItems.length > 2)
					scope.polygoncallback(polygon.getBounds());
			}


			function evaluate() {
				// console.log('scope.userLocation:', scope.userLocation);
				if (scope.userLocation && scope.userLocation.lat || panToPoly) {
					// console.log(scope.userLocation);
					createMap();
				} else {
					geocoder = new google.maps.Geocoder();
					// console.log('scope.userLocation', scope.userLocation);
					if (typeof scope.userLocation == 'string') {
						// console.log('geocoder');
						geocoder.geocode({
							'address': scope.userLocation
						}, function(results, status) {
							// console.log(status);
							if (status === 'OK') {
								scope.userLocation = {};
								scope.userLocation.lat = results[0].geometry.location.lat();
								scope.userLocation.lng = results[0].geometry.location.lng();
							}
						})
					}
					$timeout(function() {
						evaluate();
					}, 300);
				}
			}

			// callback when google maps is loaded
			$window.initMap = function() {
				google = window.google;
				// console.log('map: init callback', google);
				evaluate();
			};
			// console.log(scope.userLocation);

			function loadGMaps() {
				// console.log('map: start loading js gmaps');
				if ($window.document.getElementById('google1')) {
					return;
				}
				var script = $window.document.createElement('script');
				script.setAttribute("id", "google1");
				script.type = 'text/javascript';
				script.src = 'https://maps.googleapis.com/maps/api/js?key=' + 'AIzaSyBGV6gMFPcIqhzwjr1BfpO_PThe_BBCz18' + '&libraries=places,drawing&callback=initMap';
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

			function markerIcon(item) {
				if (angular.isObject(markersIcon)) {
					return markersIcon[item.status];
				}
				return markersIcon;
			}

			function updatePolygon() {
				// console.log('map', map);
				// console.log('scope.polygonPoints', scope.polygonPoints);
				if (map && scope.polygonPoints) {
					var pointsTo = [];
					if (typeof polygonFromPoints == 'object') {
						polygonFromPoints.setMap(null);
					}
					for (c of scope.polygonPoints) {
						pointsTo.push(new google.maps.LatLng(c.lat, c.lng));
					}
					// console.log('pointsTo', pointsTo);
					polygonPointsOptions.paths = pointsTo;
					polygonFromPoints = new google.maps.Polygon(polygonPointsOptions);
					polygonFromPoints.setMap(map);

					if (panToPoly) {
						var p_bounds = new google.maps.LatLngBounds();
						var _bounds_from_poly = polygonFromPoints.getBounds();
						for (var i = 0; i < _bounds_from_poly.length; i++) {
							p_bounds.extend(_bounds_from_poly[i]);
						}
						map.fitBounds(p_bounds);
					}
				}
			}

			// Object declaration, if not declared will fail with es5 using Object.keys
			currentMarkers = {};

			// update map markers to match scope marker collection
			function updateMarkers() {
				// console.log(scope.markers);
				if (map && scope.markers) {
					if (!angular.isObject(currentMarkers))
						return;
					var currentKeys = Object.keys(currentMarkers);
					// create new markers

					var markers = scope.markers;
					// evaluate bindings exparession
					if (angular.isString(markers)) {
						markers = scope.$eval(scope.markers);
					}
					// if no markers - remove all existing
					if (!markers.length && currentKeys.length) {
						deleteAllMarkers(currentKeys);
						return;
					}

					// remove marker
					for (var i = 0; i < currentKeys.length; i++) {
						if (!searchInArrayOfMarkers(currentKeys[i])) {
							// console.log(currentKeys[i]);
							removeMarker(currentKeys[i]);
						}
					}

					// add new markers
					for (var i = 0; i < markers.length; i++) {
						if (!searchInArray(currentKeys, markers[i])) {
							var loc = new google.maps.LatLng(markers[i].latitude, markers[i].longitude);
							var m = new google.maps.Marker({
								position: loc,
								map: map,
								animation: google.maps.Animation.DROP,
								icon: markerIcon(markers[i])
							});

							// google.maps.event.addListener(m, 'click', onItemClick(m, markers[i]));
							m.addListener('click', onItemClick(markers[i]));
							currentMarkers[markers[i][uid]] = m;
						} else {
							google.maps.event.clearListeners(currentMarkers[markers[i][uid]], 'click');
							currentMarkers[markers[i][uid]].addListener('click', onItemClick(markers[i]))
							currentMarkers[markers[i][uid]].setIcon(markerIcon(markers[i]));
						}
					}
				}
			}

			//search in array of Markers
			function searchInArrayOfMarkers(target) {
				for (var i = 0; i < scope.markers.length; i++) {
					if (scope.markers[i][uid] == target) {
						return true;
					}
				}
				return false;
			}

			//search in array of Markers
			function searchInArray(array, target) {
				for (var i = 0; i < array.length; i++) {
					if (array[i] == target[uid]) {
						return true;
					}
				}
				return false;
			}

			// Deletes all markers in the array by removing references to them.
			function deleteAllMarkers(currentKeys) {
				for (var i = 0; i < currentKeys.length; i++) {
					currentMarkers[currentKeys[i]].setMap(null);
				}
				currentMarkers = {};
			}

			// Delete single marker
			function removeMarker(id) {
				currentMarkers[id].setMap(null);
				delete currentMarkers[id];
			}
			var markerPosition;

			function updateUserLocation() {
				if (map && scope.userLocation && scope.userLocation.lat) {
					var loc = new google.maps.LatLng(scope.userLocation);
					map.setCenter(loc);
					if (scope.unsetUserMarker) {
						return;
					}
					if (!angular.isObject(markersIcon))
						map.setZoom(17);
					if (typeof markerUser !== 'undefined') {
						markerUser.setPosition(scope.userLocation);
					} else {
						markerUser = new google.maps.Marker({
							position: loc,
							map: map,
							icon: scope.userMarker ? scope.userMarker : ''
						});
					}

				}
			}

			function CenterControl(controlDiv, map) {

				// Set CSS for the control border.
				var controlUI = document.createElement('div');
				controlUI.style.cursor = 'pointer';
				controlUI.style.marginBottom = '22px';
				controlUI.style.marginLeft = '7px';
				controlUI.style.textAlign = 'center';
				controlUI.title = 'Click to recenter the map';
				controlDiv.appendChild(controlUI);

				// Set CSS for the control interior.
				var controlText = document.createElement('div');
				controlText.style.backgroundColor = 'rgb(255, 255, 255)';
				controlText.style.fontSize = '32px';
				controlText.style.lineHeight = '25px';
				controlText.style.padding = '5px';
				controlText.style.boxShadow = 'rgba(0, 0, 0, 0.298039) 0px 1px 4px -1px';
				controlText.style.borderRadius = '2px';
				controlText.innerHTML = '<i class="icon ion-android-locate"></i>';
				controlUI.appendChild(controlText);

				// Setup the click event listeners: center Map to user's location
				controlUI.addEventListener('click', function() {
					// console.log(scope.userLocation);
					map.setCenter(scope.userLocation);
					map.controls[google.maps.ControlPosition.LEFT_BOTTOM].pop();
					moved = false;
				});
			}

		}
	}
}]);
ngMaps.directive('ngmapsAutocomplete', ['$window', '$timeout', function($window, $timeout) {
	return {
		restrict: 'E',
		replace: true,
		scope: {
			newLocation: "=recenterMap"
		},
		template: '<input type="text" ng-model="address" data-tap-disabled="false" placeholder="{{text}}">',
		link: function(scope, element, attrs) {
			// console.log(attrs);
			scope.text = attrs.placeholderText || 'Enter your Address';
			// console.log(element);
			var initAutocomplete, google;

			function evaluate() {
				if ($window.google && $window.google.maps) {
					google = window.google;
					initAutocomplete();
				} else {
					$timeout(function() {
						evaluate();
					}, 100);
				}
			}

			function initAutocomplete() {
				autocomplete = new google.maps.places.Autocomplete(
					(element[0]), {
						types: ['geocode']
					}
				);
				tapfix();
				// $timeout(function() {
				//        document.querySelector('.pac-container').setAttribute('data-tap-disabled', 'true')
				//     	},500);
				autocomplete.addListener('place_changed', fillInAddress);
				// $('.pac-item, .pac-item span', this).addClass('needsclick');
			}

			function tapfix() {
				if (document.querySelector('.pac-container') !== null) {
					document.querySelector('.pac-container').setAttribute('data-tap-disabled', 'true');
				} else {
					$timeout(function() {
						tapfix();
					}, 100)
				}
			}

			function fillInAddress() {
				// Get the place details from the autocomplete object.
				var place = autocomplete.getPlace();
				// console.log(place);
				place.lat = place.geometry.location.lat();
				place.lng = place.geometry.location.lng();
				scope.newLocation(place);
				$timeout(function() {
					element.val('');
				}, 100);

			}

			if (!$window.google || !$window.google.maps) {
				evaluate();
			} else {
				google = window.google;
				initAutocomplete();
			}
		}
	}
}]);
