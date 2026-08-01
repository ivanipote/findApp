'use strict';

// ================================================================
// 🔑 CONFIGURATION
// ================================================================
var GOOGLE_MAPS_API_KEY = 'AIzaSyA4VNn_yz4H4AurK3mJ7Fk6UkuTClxoe3M';
var GITHUB_API = 'https://api.github.com/repos/ivanipote/findApp/commits?per_page=1';

// ================================================================
// 🔌 CLIENT SUPABASE
// ================================================================
var supabaseClient = null;
if (typeof supabase !== 'undefined' && typeof supabase.createClient === 'function') {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('✅ Supabase client initialisé');
} else {
    console.warn('⚠️ SDK Supabase non disponible, fallback activé');
    supabaseClient = {
        channel: function() { 
            return { 
                on: function() { return this; }, 
                subscribe: function() { return this; } 
            }; 
        },
        removeChannel: function() { return; }
    };
}

// ================================================================
// 🗺️ ÉTAT GLOBAL
// ================================================================
var state = {
    user: null,
    isAuthenticated: false,
    selectedCategories: new Set(),
    userLat: null,
    userLng: null,
    userAccuracy: null,
    following: null,
    followChannel: null,
    isTracking: false,
    isFollowingActive: false,
    map: null,
    userMarker: null,
    userPulse: null,
    trackMarker: null,
    routePolyline: null,
    routeDrawn: false,
    isNavigating: false,
    isFreeLook: false,
    watchPositionId: null,
    lastCommitDate: localStorage.getItem('last_commit_date') || null,
    transportMode: 'DRIVING',
    routePath: [],
    routeCumDistances: [],
    currentPathIndex: 0,
    offRouteCount: 0,
    isRerouting: false,
    lastKnownSpeed: 0,
    destLat: null,
    destLng: null,
    totalDistance: 0,
    followCodeValue: null,
    animFrom: null,
    animTo: null,
    animStartTime: 0,
    markerAnimFrame: null,
    ANIM_DURATION_MS: 900,
    OFF_ROUTE_STREAK_NEEDED: 3
};

// ================================================================
// CATÉGORIES
// ================================================================
var CATEGORIES = [
    { id: 'boutiques', label: 'Boutique', icon: 'fa-store', color: '#1976d2' },
    { id: 'restaurants', label: 'Restaurant', icon: 'fa-utensils', color: '#d32f2f' },
    { id: 'domiciles', label: 'Domicile', icon: 'fa-house', color: '#2ecc71' },
    { id: 'cybercafes', label: 'Cybercafé', icon: 'fa-laptop', color: '#e67e22' },
    { id: 'sante', label: 'Santé', icon: 'fa-heart-pulse', color: '#e74c3c' }
];

// ================================================================
// DOM REFS
// ================================================================
var DOM = {};

function cacheDom() {
    DOM = {
        searchHeader: document.getElementById('searchHeader'),
        searchInput: document.getElementById('searchInput'),
        menuDots: document.getElementById('menuDots'),
        dropdownMenu: document.getElementById('dropdownMenu'),
        navAdd: document.getElementById('navAdd'),
        navMe: document.getElementById('navMe'),
        navMeLabel: document.getElementById('navMeLabel'),
        navFollow: document.getElementById('navFollow'),
        navFollowLabel: document.getElementById('navFollowLabel'),
        navMesPositions: document.getElementById('navMesPositions'),
        navWhereAmI: document.getElementById('navWhereAmI'),
        navUpdateApp: document.getElementById('navUpdateApp'),
        categoriesGrid: document.getElementById('categoriesGrid'),
        resetCategories: document.getElementById('resetCategories'),
        map: document.getElementById('map'),
        toggleFollow: document.getElementById('toggleFollow'),
        posStatus: document.getElementById('posStatus'),
        toast: document.getElementById('toast'),
        btnCenterMe: document.getElementById('btnCenterMe'),
        btnCenterFollow: document.getElementById('btnCenterFollow'),
        btnCar: document.getElementById('btnCar'),
        btnFoot: document.getElementById('btnFoot'),
        gpsGarant: document.getElementById('gpsGarant'),
        btnRecenter: document.getElementById('btnRecenter'),
        followOverlay: document.getElementById('followOverlay'),
        closeFollow: document.getElementById('closeFollow'),
        followLoader: document.getElementById('followLoader'),
        followInputArea: document.getElementById('followInputArea'),
        followCode: document.getElementById('followCode'),
        followConfirmBtn: document.getElementById('followConfirmBtn'),
        followError: document.getElementById('followError'),
        whereSlider: document.getElementById('whereSlider'),
        whereClose: document.getElementById('whereClose'),
        whereLoader: document.getElementById('whereLoader'),
        whereInfo: document.getElementById('whereInfo'),
        whereFullAddress: document.getElementById('whereFullAddress'),
        updateSlider: document.getElementById('updateSlider'),
        updateClose: document.getElementById('updateClose'),
        updateStatus: document.getElementById('updateStatus'),
        updateLoading: document.getElementById('updateLoading'),
        updateDate: document.getElementById('updateDate'),
        trackSlider: document.getElementById('trackSlider'),
        trackClose: document.getElementById('trackClose'),
        trackEmail: document.getElementById('trackEmail'),
        trackDistance: document.getElementById('trackDistance'),
        trackTime: document.getElementById('trackTime'),
        trackActionBtn: document.getElementById('trackActionBtn'),
        trackBtnLabel: document.getElementById('trackBtnLabel'),
        trackAddressFull: document.getElementById('trackAddressFull'),
        trackMapsBtn: document.getElementById('trackMapsBtn'),
        trackSlides: document.getElementById('trackSlides'),
        trackDots: document.getElementById('trackDots'),
        gpsSlider: document.getElementById('gpsSlider'),
        gpsClose: document.getElementById('gpsClose'),
        gpsStatusValue: document.getElementById('gpsStatusValue'),
        gpsToggle: document.getElementById('gpsToggle'),
        gpsRefreshBtn: document.getElementById('gpsRefreshBtn'),
        gpsCenterBtn: document.getElementById('gpsCenterBtn'),
        gpsCoords: document.getElementById('gpsCoords'),
        redirectOverlay: document.getElementById('redirectOverlay')
    };
}

// ================================================================
// TOAST
// ================================================================
var toastTimer = null;

function toast(message, type, duration) {
    duration = duration || 3000;
    var el = DOM.toast;
    if (!el) { console.log(message); return; }
    el.textContent = message;
    el.className = 'toast show' + (type ? ' ' + type : '');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function() {
        el.classList.remove('show');
    }, duration);
}

// ================================================================
// API HELPERS
// ================================================================
function getHeaders(token) {
    var headers = {
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
    };
    if (token) {
        headers['Authorization'] = 'Bearer ' + token;
    }
    return headers;
}

function getSession() {
    try {
        var session = localStorage.getItem('sb_session');
        if (session) return JSON.parse(session);
    } catch (e) {}
    return null;
}

function checkAuth() {
    var session = getSession();
    if (session && session.user) {
        state.user = session.user;
        state.isAuthenticated = true;
        DOM.navMeLabel.textContent = 'Mon compte';
        return true;
    }
    state.user = null;
    state.isAuthenticated = false;
    DOM.navMeLabel.textContent = 'Se connecter';
    return false;
}

// ================================================================
// CATÉGORIES
// ================================================================
function loadSelectedCategories() {
    try {
        var saved = localStorage.getItem('selectedCategories');
        if (saved) {
            var parsed = JSON.parse(saved);
            return new Set(parsed);
        }
    } catch (e) {}
    var defaults = CATEGORIES.map(function(c) { return c.id; });
    return new Set(defaults);
}

function saveSelectedCategories() {
    localStorage.setItem('selectedCategories', JSON.stringify([...state.selectedCategories]));
}

function renderCategories() {
    var grid = DOM.categoriesGrid;
    if (!grid) return;
    grid.innerHTML = '';
    
    CATEGORIES.forEach(function(cat) {
        var item = document.createElement('div');
        var isActive = state.selectedCategories.has(cat.id);
        item.className = 'category-item' + (isActive ? ' active' : '');
        item.style.background = isActive ? cat.color + '22' : '#f8f9fc';
        item.innerHTML =
            '<span class="cat-icon"><i class="fas ' + cat.icon + '" style="color:' + cat.color + '"></i></span>' +
            '<span class="cat-label">' + cat.label + '</span>' +
            '<div class="cat-toggle"><span class="toggle-thumb"></span></div>';
        item.addEventListener('click', function() { toggleCategory(cat.id); });
        grid.appendChild(item);
    });
    
    var worldItem = document.createElement('div');
    var isWorldActive = state.selectedCategories.has('monde');
    worldItem.className = 'category-item world' + (isWorldActive ? ' active' : '');
    worldItem.style.background = isWorldActive ? '#fdf1e6' : '#f8f9fc';
    worldItem.innerHTML =
        '<span class="cat-icon"><i class="fas fa-globe" style="color:#e67e22;"></i></span>' +
        '<span class="cat-label">🌍 Monde</span>' +
        '<div class="cat-toggle"><span class="toggle-thumb"></span></div>';
    worldItem.addEventListener('click', function() { toggleWorld(); });
    grid.appendChild(worldItem);
}

function toggleCategory(id) {
    if (state.selectedCategories.has('monde')) return;
    if (state.selectedCategories.has(id)) {
        state.selectedCategories.delete(id);
    } else {
        state.selectedCategories.add(id);
    }
    saveSelectedCategories();
    renderCategories();
}

function toggleWorld() {
    if (state.selectedCategories.has('monde')) {
        state.selectedCategories = new Set(CATEGORIES.map(function(c) { return c.id; }));
    } else {
        state.selectedCategories = new Set(['monde']);
    }
    saveSelectedCategories();
    renderCategories();
}

function resetCategories() {
    state.selectedCategories = new Set(CATEGORIES.map(function(c) { return c.id; }));
    saveSelectedCategories();
    renderCategories();
}

// ================================================================
// GEOLOCALISATION
// ================================================================
function startWatchingPosition() {
    if (state.watchPositionId) {
        navigator.geolocation.clearWatch(state.watchPositionId);
        state.watchPositionId = null;
    }
    if (!navigator.geolocation) {
        state.userLat = 5.3599517;
        state.userLng = -3.9792253;
        console.warn('⚠️ Géolocalisation non disponible');
        return;
    }
    state.watchPositionId = navigator.geolocation.watchPosition(
        function(pos) {
            var lat = pos.coords.latitude;
            var lng = pos.coords.longitude;
            
            state.userLat = lat;
            state.userLng = lng;
            if (typeof pos.coords.speed === 'number' && pos.coords.speed >= 0) {
                state.lastKnownSpeed = pos.coords.speed;
            }
            
            if (DOM.posStatus) {
                DOM.posStatus.textContent = '✓';
                DOM.posStatus.className = 'pos-status online';
            }
            
            var rawLatLng = { lat: lat, lng: lng };
            
            if (state.isNavigating && state.routePath.length > 1) {
                updateNavigationPosition(rawLatLng);
            } else {
                if (state.userMarker) state.userMarker.setPosition(rawLatLng);
                if (state.userPulse) state.userPulse.setPosition(rawLatLng);
            }
            
            console.log('📍 Position mise à jour:', lat, lng);
        },
        function(err) {
            console.warn('⚠️ Erreur GPS:', err.message);
            if (DOM.posStatus) {
                DOM.posStatus.textContent = '⚠️';
                DOM.posStatus.className = 'pos-status offline';
            }
        }, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 3000
        }
    );
    console.log('📡 Suivi GPS en continu activé');
}

function initMap() {
    console.log('🗺️ initMap appelé');
    
    if (!DOM.map) {
        console.warn('⚠️ DOM pas prêt, tentative de cache...');
        cacheDom();
    }
    
    if (!DOM.map) {
        console.error('❌ DOM.map introuvable');
        toast('⚠️ Erreur d\'initialisation de la carte', 'error', 3000);
        return;
    }
    
    if (typeof google === 'undefined' || typeof google.maps === 'undefined') {
        console.warn('⚠️ Google Maps JS API non chargée');
        toast('⚠️ Google Maps non disponible', 'error', 3000);
        return;
    }

    var container = DOM.map;
    container.innerHTML = '';

    state.map = new google.maps.Map(container, {
        center: { lat: state.userLat || 5.3599517, lng: state.userLng || -3.9792253 },
        zoom: 15,
        mapTypeId: 'roadmap',
        mapTypeControl: false,
        fullscreenControl: false,
        streetViewControl: false,
        zoomControl: true,
        zoomControlOptions: {
            position: google.maps.ControlPosition.BOTTOM_RIGHT  // ← CORRECTION
        },
        mapId: 'DEMO_MAP_ID'
    });

    // ... suite du code
}
// ================================================================
// MARQUEUR DE SUIVI (Google Maps)
// ================================================================
function showTrackMarker(lat, lng, email) {
    if (state.trackMarker) {
        state.trackMarker.setMap(null);
        state.trackMarker = null;
    }

    var pinIcon = {
        url: 'https://maps.google.com/mapfiles/ms/icons/red-pin.png',
        scaledSize: new google.maps.Size(40, 40)
    };

    state.trackMarker = new google.maps.Marker({
        position: { lat: lat, lng: lng },
        map: state.map,
        icon: pinIcon,
        title: '📍 ' + email,
        zIndex: 500
    });

    var infoWindow = new google.maps.InfoWindow({
        content: '<div style="font-weight:600;color:#1a2a5a;">📍 ' + email + '</div>'
    });

    state.trackMarker.addListener('click', function() {
        infoWindow.open(state.map, state.trackMarker);
    });

    state.map.panTo({ lat: lat, lng: lng });
    state.map.setZoom(14);
}

// ================================================================
// ROUTES API - CALCUL D'ITINÉRAIRE
// ================================================================
function calculateRoute() {
    if (!state.userLat || !state.userLng || !state.following) {
        toast('⚠️ Position ou personne suivie non disponible', 'error', 3000);
        return;
    }

    var lat1 = state.userLat;
    var lng1 = state.userLng;
    var lat2 = state.following.lat;
    var lng2 = state.following.lng;

    state.destLat = lat2;
    state.destLng = lng2;

    var requestBody = {
        origin: {
            location: {
                latLng: {
                    latitude: lat1,
                    longitude: lng1
                }
            }
        },
        destination: {
            location: {
                latLng: {
                    latitude: lat2,
                    longitude: lng2
                }
            }
        },
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_AWARE',
        computeAlternativeRoutes: false,
        routeModifiers: {
            avoidTolls: false,
            avoidHighways: false,
            avoidFerries: false
        },
        languageCode: 'fr-FR',
        units: 'METRIC'
    };

    var url = 'https://routes.googleapis.com/directions/v2:computeRoutes';

    fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
            'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline'
        },
        body: JSON.stringify(requestBody)
    })
    .then(function(response) {
        if (!response.ok) throw new Error('Erreur ' + response.status);
        return response.json();
    })
    .then(function(data) {
        if (!data.routes || data.routes.length === 0) {
            throw new Error('Aucun itinéraire trouvé');
        }

        var route = data.routes[0];
        var distanceMeters = route.distanceMeters;
        var durationSeconds = parseInt(route.duration.replace('s', ''));

        state.totalDistance = distanceMeters / 1000;

        var distanceKm = (distanceMeters / 1000);
        var distanceDisplay = distanceKm < 1 ? Math.round(distanceMeters) + ' m' : distanceKm.toFixed(1) + ' km';
        var minutes = Math.round(durationSeconds / 60);
        var timeDisplay = minutes + ' min';

        if (DOM.trackDistance) DOM.trackDistance.textContent = distanceDisplay;
        if (DOM.trackTime) DOM.trackTime.textContent = timeDisplay;

        if (route.polyline && route.polyline.encodedPolyline) {
            var decodedPath = google.maps.geometry.encoding.decodePath(route.polyline.encodedPolyline);
            drawRoutePolyline(decodedPath);
            buildRoutePathData(decodedPath);
        }

        state.routeDrawn = true;
        if (DOM.trackActionBtn) {
            DOM.trackActionBtn.disabled = false;
            DOM.trackBtnLabel.textContent = '✅ Trajet calculé';
        }
        toast('✅ Itinéraire tracé avec Routes API', 'success', 2000);
    })
    .catch(function(error) {
        console.error('❌ Erreur Routes API:', error);
        toast('⚠️ Erreur: ' + error.message, 'error', 3000);
    });
}

function drawRoutePolyline(path) {
    if (state.routePolyline) {
        state.routePolyline.setMap(null);
        state.routePolyline = null;
    }

    state.routePolyline = new google.maps.Polyline({
        path: path,
        geodesic: true,
        strokeColor: '#1976d2',
        strokeOpacity: 0.9,
        strokeWeight: 5
    });

    state.routePolyline.setMap(state.map);

    var bounds = new google.maps.LatLngBounds();
    path.forEach(function(point) {
        bounds.extend(point);
    });
    state.map.fitBounds(bounds);
}

// ================================================================
// SNAP TO ROUTE — Navigation avancée
// ================================================================

function buildRoutePathData(path) {
    state.routePath = path.slice();
    state.routeCumDistances = [0];
    for (var i = 1; i < state.routePath.length; i++) {
        var d = google.maps.geometry.spherical.computeDistanceBetween(state.routePath[i - 1], state.routePath[i]);
        state.routeCumDistances.push(state.routeCumDistances[i - 1] + d);
    }
    state.currentPathIndex = 0;
}

function projectOnSegment(p, a, b) {
    var lat0 = a.lat();
    var toXY = function(pt) {
        var x = (pt.lng() - a.lng()) * Math.cos(lat0 * Math.PI / 180);
        var y = (pt.lat() - a.lat());
        return { x: x, y: y };
    };
    var A = toXY(a), B = toXY(b), P = toXY(p);
    var ABx = B.x - A.x, ABy = B.y - A.y;
    var lenSq = ABx * ABx + ABy * ABy;
    var t = lenSq === 0 ? 0 : ((P.x - A.x) * ABx + (P.y - A.y) * ABy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    var projLat = a.lat() + t * (b.lat() - a.lat());
    var projLng = a.lng() + t * (b.lng() - a.lng());
    return { point: new google.maps.LatLng(projLat, projLng), t: t };
}

function findNearestOnRoute(rawLatLng) {
    var raw = new google.maps.LatLng(rawLatLng.lat, rawLatLng.lng);
    var searchStart = Math.max(0, state.currentPathIndex - 2);
    var searchEnd = Math.min(state.routePath.length - 1, state.currentPathIndex + 40);
    var best = null;

    for (var i = searchStart; i < searchEnd; i++) {
        var proj = projectOnSegment(raw, state.routePath[i], state.routePath[i + 1]);
        var dist = google.maps.geometry.spherical.computeDistanceBetween(raw, proj.point);
        if (!best || dist < best.dist) {
            best = { dist: dist, point: proj.point, segIndex: i, t: proj.t };
        }
    }
    return best;
}

function shortestAngleDelta(from, to) {
    var diff = ((to - from + 540) % 360) - 180;
    return diff;
}

function lerp(a, b, t) { return a + (b - a) * t; }

function animateMarker(timestamp) {
    if (!state.animStartTime) state.animStartTime = timestamp;
    var elapsed = timestamp - state.animStartTime;
    var t = Math.min(1, elapsed / state.ANIM_DURATION_MS);
    var eased = 1 - Math.pow(1 - t, 3);

    var lat = lerp(state.animFrom.lat, state.animTo.lat, eased);
    var lng = lerp(state.animFrom.lng, state.animTo.lng, eased);
    var headingDelta = shortestAngleDelta(state.animFrom.heading, state.animTo.heading);
    var heading = state.animFrom.heading + headingDelta * eased;

    var pos = new google.maps.LatLng(lat, lng);
    if (state.userMarker) {
        state.userMarker.setPosition(pos);
        var icon = state.userMarker.getIcon();
        icon.rotation = heading;
        state.userMarker.setIcon(icon);
    }
    if (state.userPulse) state.userPulse.setPosition(pos);

    if (state.isNavigating && !state.isFreeLook && state.map) {
        state.map.panTo(pos);
        if (state.map.setHeading) state.map.setHeading(heading);
    }

    if (t < 1) {
        state.markerAnimFrame = requestAnimationFrame(animateMarker);
    } else {
        state.markerAnimFrame = null;
    }
}

function goToPosition(lat, lng, heading) {
    var currentPos = state.userMarker ? state.userMarker.getPosition() : null;
    var currentIcon = state.userMarker ? state.userMarker.getIcon() : null;
    state.animFrom = {
        lat: currentPos ? currentPos.lat() : lat,
        lng: currentPos ? currentPos.lng() : lng,
        heading: currentIcon && typeof currentIcon.rotation === 'number' ? currentIcon.rotation : heading
    };
    state.animTo = { lat: lat, lng: lng, heading: heading };
    state.animStartTime = 0;
    if (state.markerAnimFrame) cancelAnimationFrame(state.markerAnimFrame);
    state.markerAnimFrame = requestAnimationFrame(animateMarker);
}

function zoomForSpeed(speedMs) {
    var kmh = speedMs * 3.6;
    if (kmh < 10) return 18.5;
    if (kmh < 30) return 17.5;
    if (kmh < 60) return 16.5;
    if (kmh < 90) return 15.5;
    return 14.5;
}

function updateNavigationPosition(rawLatLng) {
    var nearest = findNearestOnRoute(rawLatLng);
    if (!nearest) return;

    var USE_RAW_THRESHOLD = 60;
    var REROUTE_THRESHOLD = 40;

    if (nearest.dist > REROUTE_THRESHOLD) {
        state.offRouteCount++;
    } else {
        state.offRouteCount = 0;
    }

    if (state.offRouteCount >= state.OFF_ROUTE_STREAK_NEEDED && !state.isRerouting) {
        state.isRerouting = true;
        toast('🔄 Hors itinéraire — recalcul en cours...', 'info', 3000);
        calculateRoute();
        state.offRouteCount = 0;
        setTimeout(function() { state.isRerouting = false; }, 4000);
        return;
    }

    var displayPos = nearest.dist <= USE_RAW_THRESHOLD
        ? nearest.point
        : new google.maps.LatLng(rawLatLng.lat, rawLatLng.lng);

    state.currentPathIndex = nearest.segIndex;

    var heading = google.maps.geometry.spherical.computeHeading(
        state.routePath[nearest.segIndex],
        state.routePath[nearest.segIndex + 1]
    );

    goToPosition(displayPos.lat(), displayPos.lng(), heading);

    if (!state.isFreeLook && state.map) {
        state.map.setZoom(zoomForSpeed(state.lastKnownSpeed));
    }

    var distAtSegStart = state.routeCumDistances[nearest.segIndex];
    var segLength = google.maps.geometry.spherical.computeDistanceBetween(
        state.routePath[nearest.segIndex], state.routePath[nearest.segIndex + 1]
    );
    var distTravelledOnSeg = segLength * nearest.t;
    var totalRouteLength = state.routeCumDistances[state.routeCumDistances.length - 1];
    var remainingMeters = Math.max(0, totalRouteLength - (distAtSegStart + distTravelledOnSeg));

    var remainingDisplay = remainingMeters < 1000
        ? Math.round(remainingMeters) + ' m'
        : (remainingMeters / 1000).toFixed(1) + ' km';
    
    if (DOM.trackDistance) {
        DOM.trackDistance.textContent = remainingDisplay;
        var statLabel = document.querySelector('.track-stat:first-child .track-stat-label');
        if (statLabel) statLabel.textContent = remainingMeters < 1000 ? 'm' : 'km';
    }

    if (state.lastKnownSpeed > 1) {
        var etaMinutes = Math.max(1, Math.round((remainingMeters / state.lastKnownSpeed) / 60));
        if (DOM.trackTime) {
            DOM.trackTime.textContent = etaMinutes + ' min';
        }
    }

    if (remainingMeters < 30) {
        arrivedDestination();
    }
}

// ================================================================
// NAVIGATION (Démarrer / Arrêter)
// ================================================================
function startNavigation() {
    if (state.isNavigating) {
        stopNavigation();
        return;
    }

    if (!state.routeDrawn) {
        toast('⚠️ Calculez d\'abord l\'itinéraire', 'error', 3000);
        return;
    }

    if (!state.userLat || !state.userLng) {
        toast('⚠️ Position non disponible', 'error', 3000);
        return;
    }

    state.isNavigating = true;
    state.currentPathIndex = 0;
    state.isFreeLook = false;
    if (DOM.btnRecenter) DOM.btnRecenter.style.display = 'none';

    // Utiliser le bouton start dans le slider (trackActionBtn)
    if (DOM.trackActionBtn) {
        DOM.trackActionBtn.textContent = '🛑 Arrêter';
        DOM.trackActionBtn.classList.add('running');
    }

    toast('🚗 Navigation démarrée ! Suivez la route', 'success', 3000);

    if (state.map) {
        state.map.setZoom(18);
        if (state.map.setTilt) state.map.setTilt(45);
    }

    updateNavigationPosition({ lat: state.userLat, lng: state.userLng });
}

function stopNavigation() {
    state.isNavigating = false;
    state.isFreeLook = false;
    if (DOM.btnRecenter) DOM.btnRecenter.style.display = 'none';

    if (DOM.trackActionBtn) {
        DOM.trackActionBtn.textContent = '🗺️ Tracer l\'itinéraire';
        DOM.trackActionBtn.classList.remove('running');
        DOM.trackActionBtn.classList.remove('arrived');
    }

    toast('🛑 Navigation arrêtée', 'info', 2000);

    if (state.map) {
        if (state.map.setTilt) state.map.setTilt(0);
        if (state.map.setHeading) state.map.setHeading(0);
    }

    if (state.userMarker) {
        var defaultIcon = {
            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            fillColor: '#1976d2',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
            scale: 6,
            rotation: 0,
            anchor: new google.maps.Point(0, 2.6)
        };
        state.userMarker.setIcon(defaultIcon);
    }

    if (DOM.trackDistance && DOM.trackTime) {
        var totalDist = state.totalDistance;
        var distanceDisplay = totalDist < 1 ? Math.round(totalDist * 1000) + ' m' : totalDist.toFixed(1) + ' km';
        DOM.trackDistance.textContent = distanceDisplay;
        var statLabel = document.querySelector('.track-stat:first-child .track-stat-label');
        if (statLabel) statLabel.textContent = totalDist < 1 ? 'm' : 'km';
    }
}

function arrivedDestination() {
    state.isNavigating = false;
    state.isFreeLook = false;
    if (DOM.btnRecenter) DOM.btnRecenter.style.display = 'none';

    if (DOM.trackActionBtn) {
        DOM.trackActionBtn.textContent = '✅ Arrivé !';
        DOM.trackActionBtn.classList.remove('running');
        DOM.trackActionBtn.classList.add('arrived');
        DOM.trackActionBtn.disabled = true;
    }

    if (DOM.trackDistance) DOM.trackDistance.textContent = '0 m';
    if (DOM.trackTime) DOM.trackTime.textContent = '0 min';

    toast('✅ Vous êtes arrivé à destination !', 'success', 4000);

    if (state.map) {
        if (state.map.setTilt) state.map.setTilt(0);
        if (state.map.setHeading) state.map.setHeading(0);
    }

    if (state.userMarker) {
        var defaultIcon = {
            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            fillColor: '#1976d2',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
            scale: 6,
            rotation: 0,
            anchor: new google.maps.Point(0, 2.6)
        };
        state.userMarker.setIcon(defaultIcon);
    }
}

// ================================================================
// CENTRER LA CARTE
// ================================================================
function centerOnMe() {
    if (!state.userLat || !state.userLng) {
        toast('📍 Position non disponible', 'error', 3000);
        return;
    }
    if (state.map) {
        state.map.panTo({ lat: state.userLat, lng: state.userLng });
        state.map.setZoom(16);
        toast('📍 Centré sur votre position', 'info', 1500);
    }
}

function centerOnFollow() {
    if (!state.following) {
        toast('👤 Aucune personne suivie', 'error', 3000);
        return;
    }
    if (!state.following.lat || !state.following.lng) {
        toast('👤 Position non disponible', 'error', 3000);
        return;
    }
    if (state.map) {
        state.map.panTo({ lat: state.following.lat, lng: state.following.lng });
        state.map.setZoom(16);
        toast('👤 Centré sur la personne suivie', 'info', 1500);
    }
}

function toggleRecenter() {
    state.isFreeLook = false;
    if (DOM.btnRecenter) DOM.btnRecenter.style.display = 'none';
    if (state.userMarker && state.userMarker.getPosition()) {
        state.map.panTo(state.userMarker.getPosition());
        state.map.setZoom(zoomForSpeed(state.lastKnownSpeed));
    }
}

// ================================================================
// SUIVI - SAUVEGARDE D'ÉTAT
// ================================================================
function saveFollowingState() {
    if (state.following) {
        var data = {
            id: state.following.id,
            code: state.following.code,
            email: state.following.email,
            lat: state.following.lat,
            lng: state.following.lng,
            userId: state.following.userId,
            timestamp: Date.now(),
            transportMode: state.transportMode
        };
        localStorage.setItem('following_state', JSON.stringify(data));
        console.log('💾 État du suivi sauvegardé');
    } else {
        localStorage.removeItem('following_state');
        console.log('🗑️ État du suivi supprimé');
    }
}

function loadFollowingState() {
    try {
        var saved = localStorage.getItem('following_state');
        if (saved) {
            var data = JSON.parse(saved);
            if (data.id && data.email && data.lat && data.lng) {
                console.log('📂 État du suivi restauré:', data.email);
                return data;
            }
        }
    } catch (e) {
        console.warn('⚠️ Erreur chargement état du suivi:', e);
    }
    return null;
}

function clearFollowingState() {
    localStorage.removeItem('following_state');
}

function restoreFollowing() {
    var lastCode = localStorage.getItem('last_follow_code');
    if (lastCode && DOM.followCode) {
        DOM.followCode.value = lastCode;
    }
    console.log('📌 Suivi non restauré automatiquement (champ code conservé)');
}

// ================================================================
// SUBSCRIBE TO FOLLOW
// ================================================================
function subscribeToFollow(recordId) {
    if (state.followChannel) {
        if (supabaseClient && typeof supabaseClient.removeChannel === 'function') {
            supabaseClient.removeChannel(state.followChannel);
        }
        state.followChannel = null;
    }
    if (!supabaseClient || typeof supabaseClient.channel !== 'function') {
        console.warn('⚠️ Supabase client non disponible, suivi sans Realtime');
        if (state._pollInterval) clearInterval(state._pollInterval);
        state._pollInterval = setInterval(function() {
            fetchPosition(recordId);
        }, 5000);
        return;
    }
    state.followChannel = supabaseClient
        .channel('shared_locations_' + recordId)
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'shared_locations',
                filter: 'id=eq.' + recordId
            },
            function(payload) {
                var newData = payload.new;
                if (newData.active === false) {
                    toast('⚠️ La personne a arrêté de partager sa position', 'error', 3000);
                    stopFollowing();
                    return;
                }
                if (state.following) {
                    state.following.lat = newData.latitude;
                    state.following.lng = newData.longitude;
                    state.following.last_update = newData.last_update || new Date().toISOString();
                }
                if (state.trackMarker) {
                    state.trackMarker.setPosition({ lat: newData.latitude, lng: newData.longitude });
                }
                saveFollowingState();
                state.routeDrawn = false;
                if (state.following) {
                    getTrackAddress(state.following.lat, state.following.lng);
                }
            }
        )
        .subscribe(function(status) {
            if (status === 'SUBSCRIBED') {
                console.log('📡 Suivi en direct connecté (realtime actif)');
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                console.warn('⚠️ Realtime indisponible, statut:', status);
                toast('⚠️ Connexion temps réel instable', 'error', 2500);
            }
        });
}

async function fetchPosition(recordId) {
    try {
        var session = getSession();
        var token = session ? session.access_token : null;
        var response = await fetch(
            SUPABASE_URL + '/rest/v1/shared_locations?id=eq.' + recordId + '&select=*&limit=1', {
                headers: getHeaders(token)
            }
        );
        if (!response.ok) return;
        var data = await response.json();
        if (!data || data.length === 0) return;
        var newData = data[0];
        if (newData.active === false) {
            toast('⚠️ La personne a arrêté de partager sa position', 'error', 3000);
            stopFollowing();
            return;
        }
        if (state.following) {
            state.following.lat = newData.latitude;
            state.following.lng = newData.longitude;
            state.following.last_update = newData.last_update || new Date().toISOString();
        }
        if (state.trackMarker) {
            state.trackMarker.setPosition({ lat: newData.latitude, lng: newData.longitude });
        }
        saveFollowingState();
        state.routeDrawn = false;
        if (state.following) {
            getTrackAddress(state.following.lat, state.following.lng);
        }
    } catch (e) {
        console.warn('⚠️ Erreur polling:', e);
    }
}

// ================================================================
// GPS GARANT
// ================================================================
function updateGpsGarant() {
    var statusEl = DOM.posStatus;
    if (!statusEl) return;
    var isActive = state.isFollowingActive;
    statusEl.textContent = isActive ? '✓' : '✗';
    statusEl.className = 'pos-status ' + (isActive ? 'online' : 'offline');
}

function openGpsSlider() {
    var isActive = state.isFollowingActive;
    DOM.gpsStatusValue.textContent = isActive ? 'Activée' : 'Désactivée';
    DOM.gpsStatusValue.className = 'gps-status-value ' + (isActive ? 'active' : 'inactive');
    DOM.gpsToggle.classList.toggle('active', isActive);
    var lat = state.userLat || '--';
    var lng = state.userLng || '--';
    var acc = state.userAccuracy || '--';
    DOM.gpsCoords.innerHTML = 
        '📍 Latitude : ' + lat + '<br />' +
        '📍 Longitude : ' + lng + '<br />' +
        '📏 Précision : ' + acc + ' m';
    DOM.gpsSlider.classList.add('active');
}

function closeGpsSlider() {
    DOM.gpsSlider.classList.remove('active');
}

function toggleGpsStatus() {
    var isActive = DOM.gpsToggle.classList.toggle('active');
    DOM.gpsStatusValue.textContent = isActive ? 'Activée' : 'Désactivée';
    DOM.gpsStatusValue.className = 'gps-status-value ' + (isActive ? 'active' : 'inactive');
    if (isActive) {
        toast('📍 Localisation activée', 'success', 1500);
        startWatchingPosition();
        DOM.toggleFollow.classList.add('active');
        state.isFollowingActive = true;
    } else {
        toast('📍 Localisation désactivée', 'info', 1500);
        stopWatchingPosition();
        DOM.toggleFollow.classList.remove('active');
        state.isFollowingActive = false;
    }
    updateGpsGarant();
}

function refreshGpsPosition() {
    toast('🔄 Rafraîchissement de la position...', 'info', 1500);
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            function(pos) {
                state.userLat = pos.coords.latitude;
                state.userLng = pos.coords.longitude;
                state.userAccuracy = Math.round(pos.coords.accuracy);
                if (state.userMarker) {
                    state.userMarker.setPosition({ lat: state.userLat, lng: state.userLng });
                }
                if (state.userPulse) {
                    state.userPulse.setPosition({ lat: state.userLat, lng: state.userLng });
                }
                var lat = state.userLat || '--';
                var lng = state.userLng || '--';
                var acc = state.userAccuracy || '--';
                DOM.gpsCoords.innerHTML = 
                    '📍 Latitude : ' + lat + '<br />' +
                    '📍 Longitude : ' + lng + '<br />' +
                    '📏 Précision : ' + acc + ' m';
                toast('✅ Position mise à jour', 'success', 1500);
            },
            function(err) {
                toast('⚠️ Erreur GPS: ' + err.message, 'error', 2000);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    }
}

function gpsCenterOnMe() {
    centerOnMe();
    closeGpsSlider();
}

// ================================================================
// OVERLAY "JE SUIS OÙ ?" (Google Geocoding)
// ================================================================
function openWhereAmI() {
    DOM.whereSlider.classList.add('active');
    DOM.whereLoader.style.display = 'flex';
    DOM.whereInfo.style.display = 'none';

    if (!navigator.geolocation) {
        DOM.whereLoader.style.display = 'none';
        DOM.whereInfo.style.display = 'block';
        DOM.whereFullAddress.textContent = 'Géolocalisation non disponible';
        toast('⚠️ Géolocalisation non disponible', 'error');
        return;
    }

    navigator.geolocation.getCurrentPosition(
        function(pos) {
            var lat = pos.coords.latitude;
            var lng = pos.coords.longitude;
            getWhereAddress(lat, lng);
        },
        function(err) {
            DOM.whereLoader.style.display = 'none';
            DOM.whereInfo.style.display = 'block';
            DOM.whereFullAddress.textContent = 'Erreur GPS: ' + err.message;
            toast('⚠️ Erreur GPS: ' + err.message, 'error');
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
}

async function getWhereAddress(lat, lng) {
    try {
        var url = 'https://maps.googleapis.com/maps/api/geocode/json' +
            '?latlng=' + lat + ',' + lng +
            '&key=' + GOOGLE_MAPS_API_KEY;

        var response = await fetch(url);
        if (!response.ok) throw new Error('Erreur Geocoding');

        var data = await response.json();
        if (data.status !== 'OK' || data.results.length === 0) {
            throw new Error('Adresse non trouvée');
        }

        DOM.whereLoader.style.display = 'none';
        DOM.whereInfo.style.display = 'block';

        var address = data.results[0].formatted_address || 'Adresse non disponible';
        DOM.whereFullAddress.textContent = address;

    } catch (e) {
        console.error('❌ Erreur Geocoding:', e);
        DOM.whereLoader.style.display = 'none';
        DOM.whereInfo.style.display = 'block';
        DOM.whereFullAddress.textContent = 'Erreur récupération adresse';
    }
}

function closeWhereAmI() {
    DOM.whereSlider.classList.remove('active');
}

// ================================================================
// OVERLAY MISE À JOUR
// ================================================================
function openUpdateSlider() {
    DOM.updateSlider.classList.add('active');
    checkForUpdate();
}

function closeUpdateSlider() {
    DOM.updateSlider.classList.remove('active');
}

function checkForUpdate() {
    DOM.updateStatus.style.display = 'none';
    DOM.updateLoading.style.display = 'flex';
    
    fetch(GITHUB_API)
        .then(function(response) {
            if (!response.ok) {
                throw new Error('Erreur API GitHub: ' + response.status);
            }
            return response.json();
        })
        .then(function(data) {
            if (!data || data.length === 0) {
                throw new Error('Aucune donnée reçue');
            }
            
            var lastCommitDate = data[0].commit.committer.date;
            var storedDate = localStorage.getItem('last_commit_date');
            
            DOM.updateLoading.style.display = 'none';
            DOM.updateStatus.style.display = 'block';
            
            var dateObj = new Date(lastCommitDate);
            var dateStr = dateObj.toLocaleDateString('fr-FR', { 
                day: '2-digit', month: 'short', year: 'numeric' 
            }) + ' ' + dateObj.toLocaleTimeString('fr-FR', { 
                hour: '2-digit', minute: '2-digit' 
            });
            
            DOM.updateDate.textContent = 'Dernière mise à jour : ' + dateStr;
            
            if (storedDate !== lastCommitDate) {
                DOM.updateStatus.innerHTML = 
                    '<i class="fas fa-sync-alt" style="color:#e67e22;font-size:2rem;"></i>' +
                    '<p class="update-text">🔄 Nouvelle version disponible !</p>' +
                    '<p class="update-date" style="color:#1976d2;font-weight:600;cursor:pointer;" id="updateNowBtn">Cliquez ici pour mettre à jour</p>';
                document.getElementById('updateNowBtn').addEventListener('click', function() {
                    performUpdate(lastCommitDate);
                });
            } else {
                DOM.updateStatus.innerHTML = 
                    '<i class="fas fa-check-circle" style="color:#2ecc71;font-size:2rem;"></i>' +
                    '<p class="update-text">✅ Votre application est à jour</p>' +
                    '<p class="update-date">' + DOM.updateDate.textContent + '</p>';
            }
        })
        .catch(function(error) {
            console.error('❌ Erreur vérification mise à jour:', error);
            DOM.updateLoading.style.display = 'none';
            DOM.updateStatus.style.display = 'block';
            DOM.updateStatus.innerHTML = 
                '<i class="fas fa-exclamation-triangle" style="color:#d32f2f;font-size:2rem;"></i>' +
                '<p class="update-text">⚠️ Impossible de vérifier les mises à jour</p>' +
                '<p class="update-date">' + error.message + '</p>';
        });
}

function performUpdate(newCommitDate) {
    toast('🔄 Mise à jour en cours...', 'info', 2000);
    localStorage.clear();
    localStorage.setItem('last_commit_date', newCommitDate);
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then(function(reg) {
            if (reg) {
                reg.update();
                caches.keys().then(function(cacheNames) {
                    cacheNames.forEach(function(cacheName) {
                        caches.delete(cacheName);
                        console.log('🗑️ Cache supprimé:', cacheName);
                    });
                });
            }
        });
    }
    setTimeout(function() {
        window.location.reload(true);
    }, 1500);
}

// ================================================================
// SUIVRE QUELQU'UN
// ================================================================
function initFollow() {
    DOM.navFollow.addEventListener('click', function(e) {
        e.preventDefault();
        DOM.dropdownMenu.classList.remove('active');
        if (state.following) {
            stopFollowing();
        } else {
            DOM.followOverlay.classList.add('active');
            DOM.followCode.value = '';
            DOM.followError.classList.remove('visible');
            DOM.followInputArea.style.display = 'block';
            DOM.followLoader.classList.remove('active');
            DOM.followConfirmBtn.disabled = false;
            DOM.followConfirmBtn.innerHTML = '<i class="fas fa-check"></i> Confirmer';
            setTimeout(function() { DOM.followCode.focus(); }, 400);
        }
    });

    DOM.closeFollow.addEventListener('click', function() {
        DOM.followOverlay.classList.remove('active');
    });

    DOM.followOverlay.addEventListener('click', function(e) {
        if (e.target === this) {
            DOM.followOverlay.classList.remove('active');
        }
    });

    DOM.followConfirmBtn.addEventListener('click', function() {
        var code = DOM.followCode.value.trim().toUpperCase();
        if (!code) {
            DOM.followError.textContent = 'Veuillez entrer un code';
            DOM.followError.classList.add('visible');
            return;
        }
        DOM.followInputArea.style.display = 'none';
        DOM.followLoader.classList.add('active');
        DOM.followConfirmBtn.disabled = true;
        DOM.followError.classList.remove('visible');
        verifyCode(code);
    });

    DOM.followCode.addEventListener('keyup', function(e) {
        if (e.key === 'Enter') {
            DOM.followConfirmBtn.click();
        }
        this.value = this.value.toUpperCase();
        DOM.followError.classList.remove('visible');
    });
}

async function verifyCode(code) {
    try {
        var session = getSession();
        var token = session ? session.access_token : null;
        var response = await fetch(
            SUPABASE_URL + '/rest/v1/shared_locations?code=eq.' + code + '&active=eq.true&select=*&limit=1', {
                headers: getHeaders(token)
            }
        );
        if (!response.ok) {
            throw new Error('Erreur serveur');
        }
        var data = await response.json();
        if (data && data.length > 0) {
            var record = data[0];
            if (session && session.user && record.user_id === session.user.id) {
                DOM.followLoader.classList.remove('active');
                DOM.followInputArea.style.display = 'block';
                DOM.followConfirmBtn.disabled = false;
                DOM.followError.textContent = '❌ Vous ne pouvez pas vous suivre vous-même !';
                DOM.followError.classList.add('visible');
                DOM.followCode.focus();
                DOM.followCode.select();
                return;
            }
            startFollowing(record);
        } else {
            DOM.followLoader.classList.remove('active');
            DOM.followInputArea.style.display = 'block';
            DOM.followConfirmBtn.disabled = false;
            DOM.followError.textContent = 'Code invalide. Veuillez réessayer.';
            DOM.followError.classList.add('visible');
            DOM.followCode.focus();
            DOM.followCode.select();
        }
    } catch (e) {
        console.error('❌ Erreur vérification code:', e);
        DOM.followLoader.classList.remove('active');
        DOM.followInputArea.style.display = 'block';
        DOM.followConfirmBtn.disabled = false;
        DOM.followError.textContent = 'Erreur de connexion. Veuillez réessayer.';
        DOM.followError.classList.add('visible');
    }
}

function startFollowing(record) {
    DOM.followOverlay.classList.remove('active');
    state.following = {
        id: record.id,
        code: record.code,
        email: record.email,
        lat: record.latitude,
        lng: record.longitude,
        userId: record.user_id,
        last_update: record.last_update || new Date().toISOString()
    };
    state.destLat = record.latitude;
    state.destLng = record.longitude;
    
    localStorage.setItem('last_follow_code', record.code);
    if (DOM.followCode) DOM.followCode.value = record.code;

    DOM.navFollowLabel.textContent = 'Arrêter de suivre';
    DOM.navFollow.querySelector('i').className = 'fas fa-stop-circle';
    toast('✅ Suivi de ' + record.email + ' activé !', 'success', 3000);
    showTrackMarker(record.latitude, record.longitude, record.email);
    subscribeToFollow(record.id);
    openTrackSlider(record);
    saveFollowingState();
    if (DOM.btnCenterFollow) {
        DOM.btnCenterFollow.classList.remove('disabled');
    }
}

function stopFollowing() {
    if (state.followChannel) {
        if (supabaseClient && typeof supabaseClient.removeChannel === 'function') {
            supabaseClient.removeChannel(state.followChannel);
        }
        state.followChannel = null;
    }
    if (state._pollInterval) {
        clearInterval(state._pollInterval);
        state._pollInterval = null;
    }
    if (state.routePolyline) {
        state.routePolyline.setMap(null);
        state.routePolyline = null;
    }
    if (state.trackMarker) {
        state.trackMarker.setMap(null);
        state.trackMarker = null;
    }
    state.following = null;
    state.isTracking = false;
    state.routeDrawn = false;
    state.isNavigating = false;
    state.routePath = [];
    state.routeCumDistances = [];
    
    DOM.navFollowLabel.textContent = 'Suivre quelqu\'un';
    DOM.navFollow.querySelector('i').className = 'fas fa-eye';
    DOM.trackSlider.classList.remove('active');
    clearFollowingState();
    if (DOM.btnCenterFollow) {
        DOM.btnCenterFollow.classList.add('disabled');
    }
    if (DOM.trackActionBtn) {
        DOM.trackActionBtn.innerHTML = '<i class="fas fa-route"></i> Calculer le trajet';
        DOM.trackActionBtn.classList.remove('running');
        DOM.trackActionBtn.classList.remove('arrived');
        DOM.trackActionBtn.disabled = true;
    }
    if (DOM.trackDistance) DOM.trackDistance.textContent = '--';
    if (DOM.trackTime) DOM.trackTime.textContent = '--';
    var statLabel = document.querySelector('.track-stat:first-child .track-stat-label');
    if (statLabel) statLabel.textContent = 'Km';
    
    toast('🛑 Suivi arrêté', 'info', 2000);
}

// ================================================================
// OVERLAY INFOS PERSONNE SUIVIE (3 slides)
// ================================================================
function openTrackSlider(record) {
    DOM.trackEmail.textContent = '📧 ' + record.email;
    DOM.trackAddressFull.textContent = 'Adresse en cours de récupération...';
    DOM.trackDistance.textContent = '--';
    DOM.trackTime.textContent = '--';
    DOM.trackActionBtn.innerHTML = '<i class="fas fa-route"></i> Calculer le trajet';
    if (DOM.trackActionBtn) DOM.trackActionBtn.disabled = false;
    DOM.trackSlider.classList.add('active');
    updateTrackDots(0);
    
    getTrackAddress(record.lat, record.lng);
    
    DOM.trackActionBtn.onclick = function() {
        calculateRoute();
    };
    DOM.trackMapsBtn.onclick = function() {
        openRouteInGoogleMaps();
    };
    
    DOM.trackSlides.addEventListener('scroll', function() {
        var slideWidth = this.offsetWidth || 300;
        var index = Math.round(this.scrollLeft / slideWidth);
        var total = DOM.trackDots.querySelectorAll('.dot').length;
        if (index >= 0 && index < total) {
            updateTrackDots(index);
        }
    });
    
    DOM.trackDots.querySelectorAll('.dot').forEach(function(dot) {
        dot.addEventListener('click', function() {
            var index = parseInt(this.dataset.index);
            var slideWidth = DOM.trackSlides.offsetWidth || 300;
            DOM.trackSlides.scrollLeft = index * slideWidth;
            updateTrackDots(index);
        });
    });
    
    DOM.trackClose.onclick = function() {
        DOM.trackSlider.classList.remove('active');
    };
}

function updateTrackDots(activeIndex) {
    var dots = DOM.trackDots.querySelectorAll('.dot');
    dots.forEach(function(dot, i) {
        dot.classList.toggle('active', i === activeIndex);
    });
}

async function getTrackAddress(lat, lng) {
    if (!lat || !lng) {
        DOM.trackAddressFull.textContent = 'Position non disponible';
        return;
    }
    try {
        var url = 'https://maps.googleapis.com/maps/api/geocode/json' +
            '?latlng=' + lat + ',' + lng +
            '&key=' + GOOGLE_MAPS_API_KEY;

        var response = await fetch(url);
        if (!response.ok) throw new Error('Erreur Geocoding');

        var data = await response.json();
        if (data.status !== 'OK' || data.results.length === 0) {
            throw new Error('Adresse non trouvée');
        }

        var address = data.results[0].formatted_address || 'Adresse non disponible';
        DOM.trackAddressFull.textContent = address;

    } catch (e) {
        console.error('❌ Erreur adresse:', e);
        DOM.trackAddressFull.textContent = 'Adresse non disponible';
    }
}

function openRouteInGoogleMaps() {
    if (!state.following) {
        toast('⚠️ Aucune personne suivie', 'error', 3000);
        return;
    }
    var lat1 = state.userLat || 5.3599517;
    var lng1 = state.userLng || -3.9792253;
    var lat2 = state.following.lat;
    var lng2 = state.following.lng;
    
    if (isNaN(lat2) || isNaN(lng2) || lat2 === 0 || lng2 === 0) {
        toast('⚠️ Position non disponible', 'error', 3000);
        return;
    }
    
    var url = 'https://www.google.com/maps/dir/' + 
        lat1 + ',' + lng1 + '/' + 
        lat2 + ',' + lng2;
    window.open(url, '_blank');
}

// ================================================================
// DROPDOWN MENU
// ================================================================
function initDropdown() {
    if (!DOM.menuDots) return;
    DOM.menuDots.addEventListener('click', function(e) {
        e.stopPropagation();
        DOM.dropdownMenu.classList.toggle('active');
    });
    document.addEventListener('click', function(e) {
        if (DOM.dropdownMenu && !DOM.dropdownMenu.contains(e.target) && e.target !== DOM.menuDots) {
            DOM.dropdownMenu.classList.remove('active');
        }
    });
    if (DOM.navAdd) {
        DOM.navAdd.addEventListener('click', function(e) {
            e.preventDefault();
            DOM.dropdownMenu.classList.remove('active');
            if (!state.isAuthenticated) {
                toast('🔐 Connectez-vous pour ajouter un lieu', 'error', 3000);
                return;
            }
            window.location.href = 'add.html';
        });
    }
    if (DOM.navMe) {
        DOM.navMe.addEventListener('click', function(e) {
            e.preventDefault();
            DOM.dropdownMenu.classList.remove('active');
            if (state.isAuthenticated) {
                window.location.href = 'me.html';
            } else {
                window.location.href = 'login.html';
            }
        });
    }
    if (DOM.navMesPositions) {
        DOM.navMesPositions.addEventListener('click', function(e) {
            e.preventDefault();
            DOM.dropdownMenu.classList.remove('active');
            if (!state.isAuthenticated) {
                toast('🔐 Connectez-vous pour voir vos positions', 'error', 3000);
                return;
            }
            window.location.href = 'mespositions.html';
        });
    }
    if (DOM.navWhereAmI) {
        DOM.navWhereAmI.addEventListener('click', function(e) {
            e.preventDefault();
            DOM.dropdownMenu.classList.remove('active');
            openWhereAmI();
        });
    }
    if (DOM.navUpdateApp) {
        DOM.navUpdateApp.addEventListener('click', function(e) {
            e.preventDefault();
            DOM.dropdownMenu.classList.remove('active');
            openUpdateSlider();
        });
    }
}

// ================================================================
// SEARCH
// ================================================================
function initSearch() {
    if (DOM.searchHeader) {
        DOM.searchHeader.addEventListener('click', function(e) {
            if (e.target.closest('.menu-dots') || e.target.closest('.dropdown-menu')) return;
            window.location.href = 'rech.html';
        });
    }
}

// ================================================================
// FOLLOW TOGGLE (GPS)
// ================================================================
function initFollowToggle() {
    if (!DOM.toggleFollow) return;
    DOM.toggleFollow.classList.remove('active');
    state.isFollowingActive = false;
    DOM.toggleFollow.addEventListener('click', function() {
        this.classList.toggle('active');
        state.isFollowingActive = this.classList.contains('active');
        if (state.isFollowingActive) {
            toast('📍 Suivi GPS activé', 'info', 1500);
            if (state.userLat && state.userLng && state.map) {
                state.map.panTo({ lat: state.userLat, lng: state.userLng });
                state.map.setZoom(15);
            }
            startWatchingPosition();
            updateGpsGarant();
        } else {
            toast('📍 Suivi GPS désactivé', 'info', 1500);
            stopWatchingPosition();
            updateGpsGarant();
        }
    });
}

// ================================================================
// BOUTONS HEADER CARTE
// ================================================================
function initHeaderButtons() {
    if (DOM.btnCenterMe) {
        DOM.btnCenterMe.addEventListener('click', function(e) {
            e.stopPropagation();
            centerOnMe();
        });
    }
    if (DOM.btnCenterFollow) {
        DOM.btnCenterFollow.addEventListener('click', function(e) {
            e.stopPropagation();
            centerOnFollow();
        });
    }
    if (DOM.btnCar) {
        DOM.btnCar.addEventListener('click', function(e) {
            e.stopPropagation();
            state.transportMode = 'DRIVING';
            DOM.btnCar.classList.add('active');
            DOM.btnFoot.classList.remove('active');
            toast('🚗 Mode voiture', 'info', 1500);
        });
    }
    if (DOM.btnFoot) {
        DOM.btnFoot.addEventListener('click', function(e) {
            e.stopPropagation();
            state.transportMode = 'WALKING';
            DOM.btnFoot.classList.add('active');
            DOM.btnCar.classList.remove('active');
            toast('🚶 Mode piéton', 'info', 1500);
        });
    }
    if (DOM.gpsGarant) {
        DOM.gpsGarant.addEventListener('click', function(e) {
            e.stopPropagation();
            openGpsSlider();
        });
    }
    if (DOM.btnRecenter) {
        DOM.btnRecenter.addEventListener('click', function(e) {
            e.stopPropagation();
            toggleRecenter();
        });
    }
}

// ================================================================
// SLIDER EVENTS
// ================================================================
function initSliderEvents() {
    if (DOM.whereClose) {
        DOM.whereClose.addEventListener('click', closeWhereAmI);
    }
    DOM.whereSlider.addEventListener('click', function(e) {
        if (e.target === this) {
            closeWhereAmI();
        }
    });
    if (DOM.updateClose) {
        DOM.updateClose.addEventListener('click', closeUpdateSlider);
    }
    DOM.updateSlider.addEventListener('click', function(e) {
        if (e.target === this) {
            closeUpdateSlider();
        }
    });
    if (DOM.gpsClose) {
        DOM.gpsClose.addEventListener('click', closeGpsSlider);
    }
    DOM.gpsSlider.addEventListener('click', function(e) {
        if (e.target === this) {
            closeGpsSlider();
        }
    });
    if (DOM.gpsToggle) {
        DOM.gpsToggle.addEventListener('click', toggleGpsStatus);
    }
    if (DOM.gpsRefreshBtn) {
        DOM.gpsRefreshBtn.addEventListener('click', refreshGpsPosition);
    }
    if (DOM.gpsCenterBtn) {
        DOM.gpsCenterBtn.addEventListener('click', gpsCenterOnMe);
    }
    DOM.trackSlider.addEventListener('click', function(e) {
        if (e.target === this) {
            DOM.trackSlider.classList.remove('active');
        }
    });
}

// ================================================================
// REDIRECTION VERS INFO.HTML
// ================================================================
function redirectToInfo(placeId) {
    var overlay = DOM.redirectOverlay;
    overlay.classList.add('active');
    setTimeout(function() {
        window.location.href = 'info.html?place=' + placeId;
    }, 1200);
}

// ================================================================
// SERVICE WORKER - PWA
// ================================================================
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
            .then(function(registration) {
                console.log('✅ Service Worker enregistré');
            })
            .catch(function(error) {
                console.log('❌ Service Worker échoué:', error);
            });
    }
}

// ================================================================
// INIT
// ================================================================
function init() {
    console.log('🚀 Initialisation de l\'application...');
    cacheDom();
    checkAuth();
    
    state.selectedCategories = loadSelectedCategories();
    renderCategories();
    
    startWatchingPosition();
    state.isFollowingActive = true;
    if (DOM.toggleFollow) DOM.toggleFollow.classList.add('active');
    updateGpsGarant();
    
    initSearch();
    initFollowToggle();
    initDropdown();
    initFollow();
    initHeaderButtons();
    initSliderEvents();
    
    if (DOM.resetCategories) {
        DOM.resetCategories.addEventListener('click', resetCategories);
    }
    if (DOM.btnCenterFollow) {
        DOM.btnCenterFollow.classList.add('disabled');
    }
    
    registerServiceWorker();
    restoreFollowing();
    
    // La carte sera initialisée via le callback Google Maps
    // Si Google Maps est déjà chargé, on initie la carte
    if (typeof google !== 'undefined' && typeof google.maps !== 'undefined') {
        initMap();
    }
    
    console.log('🏠 easily by megane — prêt');
    console.log('🔐 Authentifié:', state.isAuthenticated);
    console.log('📌 Catégories sélectionnées:', [...state.selectedCategories]);
}

// Exposer initMap globalement pour le callback Google Maps
window.initMap = initMap;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
