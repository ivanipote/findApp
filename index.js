'use strict';

// ================================================================
// 🔑 CONFIGURATION SUPABASE
// ================================================================
var SUPABASE_URL = 'https://slanrdeaxapzfqtuqhbf.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsYW5yZGVheGFwemZxdHVxaGJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzMzA3OTcsImV4cCI6MjEwMDkwNjc5N30.pUCb_N-66pjFs-QP2RefsqjAnffC4Rbq-rP9qHfnvK8';

// ================================================================
// 🔑 CONFIGURATION GRAPHHOPPER
// ================================================================
var GRAPHHOPPER_KEY = 'b1993ed7-7342-44e5-a31b-3bad5d6abde8';
var GRAPHHOPPER_URL = 'https://graphhopper.com/api/1/route';

// ✅ Mode de transport par défaut
var transportMode = 'car'; // 'car' | 'foot' | 'bike'

function getGraphHopperProfile() {
    return transportMode;
}

// ================================================================
// 🔑 CONFIGURATION GITHUB
// ================================================================
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

console.log('supabaseClient:', typeof supabaseClient);

// ================================================================
// CATÉGORIES
// ================================================================
var CATEGORIES = [
    { id: 'boutiques', label: 'Boutique', icon: 'fa-store', color: '#1976d2' },
    { id: 'restaurants', label: 'Restaurant', icon: 'fa-utensils', color: '#d32f2f' },
    { id: 'domiciles', label: 'Domicile', icon: 'fa-house', color: '#2ecc71' },
    { id: 'cybercafes', label: 'Cybercafé', icon: 'fa-laptop', color: '#e67e22' },
    { id: 'sante', label: 'Santé', icon: 'fa-heart-pulse', color: '#e74c3c' },
    { id: 'stations', label: 'Station', icon: 'fa-gas-pump', color: '#3498db' }
];

// ================================================================
// ÉTAT
// ================================================================
var state = {
    user: null,
    isAuthenticated: false,
    selectedCategories: new Set(),
    userLat: null,
    userLng: null,
    following: null,
    followChannel: null,
    isTracking: false,
    isFollowingActive: false,
    map: null,
    userMarker: null,
    trackMarker: null,
    trackSourceId: null,
    trackLayerId: null,
    trackPolyline: null,
    popup: null,
    routeDrawn: false,
    slideIndex: 0,
    osrmData: {
        distance: '--',
        time: '--',
        unit: 'Km'
    },
    geoInfo: {
        display_name: '',
        road: '',
        suburb: '',
        city: '',
        country: ''
    },
    whereData: {
        lat: null,
        lng: null,
        address: null,
        road: null,
        suburb: null,
        city: null,
        country: null
    },
    watchPositionId: null,
    lastCommitDate: localStorage.getItem('last_commit_date') || null
};

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
        categoriesSection: document.getElementById('categoriesSection'),
        map: document.getElementById('map'),
        toggleFollow: document.getElementById('toggleFollow'),
        posStatus: document.getElementById('posStatus'),
        toast: document.getElementById('toast'),
        btnCenterMe: document.getElementById('btnCenterMe'),
        btnCenterFollow: document.getElementById('btnCenterFollow'),
        btnCar: document.getElementById('btnCar'),
        btnFoot: document.getElementById('btnFoot'),
        followOverlay: document.getElementById('followOverlay'),
        closeFollow: document.getElementById('closeFollow'),
        followLoader: document.getElementById('followLoader'),
        followInputArea: document.getElementById('followInputArea'),
        followCode: document.getElementById('followCode'),
        followConfirmBtn: document.getElementById('followConfirmBtn'),
        followError: document.getElementById('followError'),
        trackSlider: document.getElementById('trackSlider'),
        trackClose: document.getElementById('trackClose'),
        trackEmail: document.getElementById('trackEmail'),
        trackTimestamp: document.getElementById('trackTimestamp'),
        trackDistance: document.getElementById('trackDistance'),
        trackTime: document.getElementById('trackTime'),
        trackActionBtn: document.getElementById('trackActionBtn'),
        trackBtnLabel: document.getElementById('trackBtnLabel'),
        trackSlides: document.getElementById('trackSlides'),
        trackDots: document.getElementById('trackDots'),
        geoFullAddress: document.getElementById('geoFullAddress'),
        geoSuburb: document.getElementById('geoSuburb'),
        geoCity: document.getElementById('geoCity'),
        geoCountry: document.getElementById('geoCountry'),
        geoRoad: document.getElementById('geoRoad'),
        geoEmail: document.getElementById('geoEmail'),
        geoCode: document.getElementById('geoCode'),
        geoLastUpdate: document.getElementById('geoLastUpdate'),
        btnGeoRefresh: document.getElementById('btnGeoRefresh'),
        btnOpenMaps: document.getElementById('btnOpenMaps'),
        redirectOverlay: document.getElementById('redirectOverlay'),
        // Where Am I
        whereSlider: document.getElementById('whereSlider'),
        whereClose: document.getElementById('whereClose'),
        whereContent: document.getElementById('whereContent'),
        whereLoader: document.getElementById('whereLoader'),
        whereInfo: document.getElementById('whereInfo'),
        whereFullAddress: document.getElementById('whereFullAddress'),
        whereSuburb: document.getElementById('whereSuburb'),
        whereCity: document.getElementById('whereCity'),
        whereCountry: document.getElementById('whereCountry'),
        whereRoad: document.getElementById('whereRoad'),
        whereMapsBtn: document.getElementById('whereMapsBtn'),
        whereCenterBtn: document.getElementById('whereCenterBtn')
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
// SESSION
// ================================================================
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
// API HELPERS
// ================================================================
function getHeaders(token) {
    var headers = {
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
    };
    if (token) {
        headers['Authorization'] = 'Bearer ' + token;
    } else {
        headers['Authorization'] = 'Bearer ' + SUPABASE_ANON_KEY;
    }
    return headers;
}

async function apiFetch(endpoint, options, token) {
    options = options || {};
    options.headers = Object.assign({}, getHeaders(token), options.headers || {});
    var response = await fetch(SUPABASE_URL + endpoint, options);
    if (!response.ok) {
        var text = await response.text();
        throw new Error('Erreur ' + response.status + ': ' + text);
    }
    var contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
        var text = await response.text();
        if (!text || text.trim() === '') return null;
        try { return JSON.parse(text); } catch(e) { return null; }
    }
    return null;
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
    return new Set(CATEGORIES.map(function(c) { return c.id; }));
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
}

function toggleCategory(id) {
    if (state.selectedCategories.has(id)) {
        state.selectedCategories.delete(id);
    } else {
        state.selectedCategories.add(id);
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
// GEOLOCALISATION - SUIVI EN CONTINU AVEC watchPosition()
// ================================================================
function startWatchingPosition() {
    // Nettoyer l'ancien watch s'il existe
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
            
            if (DOM.posStatus) DOM.posStatus.textContent = '✓';
            
            updateUserMarker(lat, lng);
            
            // Si on suit quelqu'un et que l'itinéraire est déjà tracé, on recalcule
            if (state.following && state.routeDrawn) {
                traceRouteGraphHopper();
            }
            
            console.log('📍 Position mise à jour en temps réel:', lat, lng);
        },
        function(err) {
            console.warn('⚠️ Erreur GPS watch:', err.message);
            if (DOM.posStatus) DOM.posStatus.textContent = '⚠️';
        }, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 3000    // Mise à jour toutes les 3 secondes
        }
    );
    
    console.log('📡 Suivi GPS en continu activé');
}

function stopWatchingPosition() {
    if (state.watchPositionId) {
        navigator.geolocation.clearWatch(state.watchPositionId);
        state.watchPositionId = null;
        console.log('🛑 Suivi GPS en continu arrêté');
    }
}

// ================================================================
// MAP - MAPLIBRE GL JS (OpenStreetMap)
// ================================================================
function initMap() {
    if (typeof maplibregl === 'undefined') {
        console.warn('⚠️ MapLibre GL JS non chargé');
        return;
    }

    var oldCanvas = document.querySelector('.maplibregl-canvas');
    if (oldCanvas) {
        oldCanvas.remove();
    }

    state.map = new maplibregl.Map({
        container: DOM.map,
        style: {
            version: 8,
            sources: {
                'osm': {
                    type: 'raster',
                    tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
                    tileSize: 256,
                    attribution: '&copy; OpenStreetMap contributors'
                }
            },
            layers: [{
                id: 'osm',
                type: 'raster',
                source: 'osm',
                minzoom: 0,
                maxzoom: 19
            }]
        },
        center: [state.userLng || -3.9792253, state.userLat || 5.3599517],
        zoom: 14,
        pitch: 0,
        bearing: 0,
        antialias: true,
        attributionControl: true
    });

    state.map.addControl(new maplibregl.NavigationControl({
        showCompass: true,
        showZoom: true,
        visualizePitch: true
    }));

    state.map.addControl(new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
        showUserLocation: true
    }));

    var userEl = document.createElement('div');
    userEl.className = 'user-marker-map';
    userEl.innerHTML = '<div class="user-pulse"><div class="user-dot"></div></div>';

    state.userMarker = new maplibregl.Marker({
        element: userEl,
        anchor: 'center'
    })
    .setLngLat([state.userLng || -3.9792253, state.userLat || 5.3599517])
    .addTo(state.map);

    var userPopup = new maplibregl.Popup({ offset: 25 })
        .setText('📍 Ma position');
    state.userMarker.setPopup(userPopup);

    state.map.on('load', function() {
        console.log('🗺️ Carte OpenStreetMap chargée');
        if (state.userLat && state.userLng) {
            state.map.flyTo({ center: [state.userLng, state.userLat], zoom: 15 });
        }
        setTimeout(function() {
            restoreFollowing();
        }, 500);
    });

    setTimeout(function() {
        state.map.resize();
    }, 400);
}

function updateUserMarker(lat, lng) {
    if (!state.userMarker) return;
    state.userMarker.setLngLat([lng, lat]);
    if (DOM.posStatus) DOM.posStatus.textContent = '✓';
    state.userLat = lat;
    state.userLng = lng;
    
    if (state.isFollowingActive && state.map) {
        state.map.flyTo({ center: [lng, lat], zoom: 15 });
    }
}

// ================================================================
// MARQUEUR DE SUIVI
// ================================================================
function showTrackMarker(lat, lng, email) {
    if (state.trackMarker) {
        state.trackMarker.remove();
        state.trackMarker = null;
    }

    var trackEl = document.createElement('div');
    trackEl.className = 'track-pin-map';
    trackEl.innerHTML = '<i class="fas fa-map-pin" style="color:#e74c3c;font-size:32px;text-shadow:0 2px 8px rgba(0,0,0,0.3);"></i>';

    state.trackMarker = new maplibregl.Marker({
        element: trackEl,
        anchor: 'bottom'
    })
    .setLngLat([lng, lat])
    .addTo(state.map);

    var trackPopup = new maplibregl.Popup({ offset: 30 })
        .setText('📍 ' + email);
    state.trackMarker.setPopup(trackPopup);

    trackEl.addEventListener('click', function() {
        if (state.following) {
            openTrackSlider(state.following);
        }
    });

    state.map.flyTo({ center: [lng, lat], zoom: 14 });
}

// ================================================================
// DESSINER L'ITINÉRAIRE (MapLibre)
// ================================================================
function drawRoute(coordinates) {
    if (state.trackPolyline) {
        state.trackPolyline.remove();
        state.trackPolyline = null;
    }

    if (state.trackSourceId) {
        try { state.map.removeSource(state.trackSourceId); } catch(e) {}
        state.trackSourceId = null;
    }

    if (state.trackLayerId) {
        try { state.map.removeLayer(state.trackLayerId); } catch(e) {}
        state.trackLayerId = null;
    }

    if (!coordinates || coordinates.length === 0) return;

    var geojson = {
        type: 'Feature',
        geometry: {
            type: 'LineString',
            coordinates: coordinates
        }
    };

    state.trackSourceId = 'route-source-' + Date.now();
    state.trackLayerId = 'route-layer-' + Date.now();

    state.map.addSource(state.trackSourceId, {
        type: 'geojson',
        data: geojson
    });

    state.map.addLayer({
        id: state.trackLayerId,
        type: 'line',
        source: state.trackSourceId,
        layout: {
            'line-join': 'round',
            'line-cap': 'round'
        },
        paint: {
            'line-color': '#1976d2',
            'line-width': 5,
            'line-opacity': 0.9,
            'line-blur': 0.5
        }
    });

    var bounds = coordinates.reduce(function(bounds, coord) {
        return bounds.extend(coord);
    }, new maplibregl.LngLatBounds(coordinates[0], coordinates[0]));

    state.map.fitBounds(bounds, { padding: 50 });

    state.trackPolyline = {
        remove: function() {
            if (state.trackLayerId) {
                try { state.map.removeLayer(state.trackLayerId); } catch(e) {}
                state.trackLayerId = null;
            }
            if (state.trackSourceId) {
                try { state.map.removeSource(state.trackSourceId); } catch(e) {}
                state.trackSourceId = null;
            }
        }
    };

    state.routeDrawn = true;
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
        state.map.flyTo({ center: [state.userLng, state.userLat], zoom: 15 });
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
        state.map.flyTo({ center: [state.following.lng, state.following.lat], zoom: 15 });
        toast('👤 Centré sur la personne suivie', 'info', 1500);
    }
}

// ================================================================
// MODE DE TRANSPORT (GraphHopper)
// ================================================================
function setTransportMode(mode) {
    transportMode = mode;
    
    if (DOM.btnCar) DOM.btnCar.classList.toggle('active', mode === 'car');
    if (DOM.btnFoot) DOM.btnFoot.classList.toggle('active', mode === 'foot');
    
    var labelMap = {
        'car': '🚗 Voiture',
        'foot': '🚶 Piéton',
        'bike': '🚲 Vélo'
    };
    
    toast(labelMap[mode] || 'Mode ' + mode, 'info', 1500);
    
    if (state.routeDrawn && state.following) {
        traceRouteGraphHopper();
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
            geoInfo: state.geoInfo || {},
            osrmData: state.osrmData || { distance: '--', time: '--', unit: 'Km' },
            transportMode: transportMode
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

    // ============================================================
    // NAV "Mettre à jour"
    // ============================================================
    if (DOM.navUpdateApp) {
        DOM.navUpdateApp.addEventListener('click', function(e) {
            e.preventDefault();
            DOM.dropdownMenu.classList.remove('active');
            checkForUpdate();
        });
    }
}

// ================================================================
// BOUTONS HEADER
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
            setTransportMode('car');
        });
    }

    if (DOM.btnFoot) {
        DOM.btnFoot.addEventListener('click', function(e) {
            e.stopPropagation();
            setTransportMode('foot');
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
                state.map.flyTo({ center: [state.userLng, state.userLat], zoom: 15 });
            }
            startWatchingPosition();
        } else {
            toast('📍 Suivi GPS désactivé', 'info', 1500);
            stopWatchingPosition();
        }
    });
}

// ================================================================
// SUIVRE QUELQU'UN
// ================================================================
function initFollow() {
    DOM.navFollow.addEventListener('click', function(e) {
        e.preventDefault();
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

    if (state.trackPolyline) {
        state.trackPolyline.remove();
        state.trackPolyline = null;
    }

    if (state.trackMarker) {
        state.trackMarker.remove();
        state.trackMarker = null;
    }

    state.following = null;
    state.isTracking = false;
    state.routeDrawn = false;
    state.slideIndex = 0;
    state.geoInfo = { display_name: '', road: '', suburb: '', city: '', country: '' };
    state.osrmData = { distance: '--', time: '--', unit: 'Km' };

    DOM.navFollowLabel.textContent = 'Suivre quelqu\'un';
    DOM.navFollow.querySelector('i').className = 'fas fa-eye';
    DOM.trackSlider.classList.remove('active');

    clearFollowingState();

    if (DOM.btnCenterFollow) {
        DOM.btnCenterFollow.classList.add('disabled');
    }

    toast('🛑 Suivi arrêté', 'info', 2000);
}

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
                    state.trackMarker.setLngLat([newData.longitude, newData.latitude]);
                }

                updateTimestamp(state.following ? state.following.last_update : null);
                saveFollowingState();
                state.routeDrawn = false;
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

// Fallback polling
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
            state.trackMarker.setLngLat([newData.longitude, newData.latitude]);
        }

        updateTimestamp(state.following ? state.following.last_update : null);
        saveFollowingState();
        state.routeDrawn = false;

    } catch (e) {
        console.warn('⚠️ Erreur polling:', e);
    }
}

// ================================================================
// INFOS GÉOGRAPHIQUES (Nominatim)
// ================================================================
async function getLocationInfo(lat, lng) {
    try {
        var url = 'https://nominatim.openstreetmap.org/reverse' +
            '?lat=' + lat +
            '&lon=' + lng +
            '&format=json' +
            '&zoom=16' +
            '&addressdetails=1';

        var response = await fetch(url);
        if (!response.ok) return null;

        var data = await response.json();

        if (data) {
            return {
                display_name: data.display_name || 'Adresse non disponible',
                road: (data.address && data.address.road) || (data.address && data.address.street) || '',
                suburb: (data.address && data.address.suburb) || (data.address && data.address.neighbourhood) || (data.address && data.address.quarter) || '',
                city: (data.address && data.address.city) || (data.address && data.address.town) || (data.address && data.address.village) || '',
                country: (data.address && data.address.country) || ''
            };
        }
        return null;
    } catch (e) {
        console.warn('⚠️ Erreur Nominatim:', e);
        return null;
    }
}

// ================================================================
// METTRE À JOUR LES INFOS GÉOGRAPHIQUES
// ================================================================
function updateGeoInfo(geoInfo, record) {
    if (!geoInfo) return;

    state.geoInfo = geoInfo;

    if (DOM.geoFullAddress) DOM.geoFullAddress.textContent = geoInfo.display_name || '--';
    if (DOM.geoSuburb) DOM.geoSuburb.textContent = geoInfo.suburb || '--';
    if (DOM.geoCity) DOM.geoCity.textContent = geoInfo.city || '--';
    if (DOM.geoCountry) DOM.geoCountry.textContent = geoInfo.country || '--';
    if (DOM.geoRoad) DOM.geoRoad.textContent = geoInfo.road || '--';

    if (record) {
        if (DOM.geoEmail) DOM.geoEmail.textContent = record.email || '--';
        if (DOM.geoCode) DOM.geoCode.textContent = record.code || '--';
        if (DOM.geoLastUpdate) {
            var date = record.last_update ? new Date(record.last_update) : new Date();
            DOM.geoLastUpdate.textContent = date.toLocaleDateString('fr-FR') + ' ' +
                date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        }
    }
}

// ================================================================
// RAFRAÎCHIR LES INFOS GÉOGRAPHIQUES
// ================================================================
async function refreshGeoInfo() {
    if (!state.following) {
        toast('⚠️ Aucune personne suivie', 'error', 3000);
        return;
    }

    var lat = state.following.lat;
    var lng = state.following.lng;

    if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) {
        toast('⚠️ Position non disponible', 'error', 3000);
        return;
    }

    try {
        DOM.btnGeoRefresh.disabled = true;
        DOM.btnGeoRefresh.innerHTML = '<span class="spinner"></span> Recherche...';

        var geoInfo = await getLocationInfo(lat, lng);
        if (geoInfo) {
            updateGeoInfo(geoInfo, state.following);
            toast('✅ Infos du lieu mises à jour', 'success', 2000);
            console.log('📍 Infos géographiques:', geoInfo.display_name);
        } else {
            toast('⚠️ Aucune info trouvée', 'error', 3000);
        }
    } catch (e) {
        console.error('❌ Erreur:', e);
        toast('❌ Erreur: ' + e.message, 'error', 3000);
    } finally {
        DOM.btnGeoRefresh.disabled = false;
        DOM.btnGeoRefresh.innerHTML = '<i class="fas fa-sync-alt"></i> Récupérer les infos du lieu';
    }
}

// ================================================================
// RESTAURER LE SUIVI
// ================================================================
function restoreFollowing() {
    var saved = loadFollowingState();
    if (!saved) return;

    console.log('🔄 Restauration du suivi:', saved.email);

    if (!state.map) {
        setTimeout(function() {
            restoreFollowing();
        }, 500);
        return;
    }

    state.following = {
        id: saved.id,
        code: saved.code,
        email: saved.email,
        lat: saved.lat,
        lng: saved.lng,
        userId: saved.userId,
        last_update: new Date(saved.timestamp).toISOString()
    };

    if (saved.geoInfo) {
        state.geoInfo = saved.geoInfo;
    }

    if (saved.osrmData) {
        state.osrmData = saved.osrmData;
    }

    if (saved.transportMode) {
        transportMode = saved.transportMode;
        if (DOM.btnCar) DOM.btnCar.classList.toggle('active', transportMode === 'car');
        if (DOM.btnFoot) DOM.btnFoot.classList.toggle('active', transportMode === 'foot');
    }

    DOM.navFollowLabel.textContent = 'Arrêter de suivre';
    DOM.navFollow.querySelector('i').className = 'fas fa-stop-circle';

    showTrackMarker(saved.lat, saved.lng, saved.email);
    openTrackSlider({
        id: saved.id,
        code: saved.code,
        email: saved.email,
        lat: saved.lat,
        lng: saved.lng,
        userId: saved.userId,
        last_update: state.following.last_update
    });

    subscribeToFollow(saved.id);
    updateTimestamp(state.following.last_update);

    if (saved.geoInfo) {
        updateGeoInfo(saved.geoInfo, state.following);
    }

    if (DOM.btnCenterFollow) {
        DOM.btnCenterFollow.classList.remove('disabled');
    }

    toast('📍 Suivi restauré : ' + saved.email, 'info', 3000);
}

// ================================================================
// METTRE À JOUR L'HORODATAGE
// ================================================================
function updateTimestamp(date) {
    var timestampEl = DOM.trackTimestamp;
    if (!timestampEl) return;

    var now = new Date();
    var timeStr, dateStr;

    if (date) {
        var updateTime = new Date(date);
        timeStr = updateTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        dateStr = updateTime.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
    } else {
        timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        dateStr = now.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    timestampEl.textContent = '⏱️ Dernière mise à jour : ' + dateStr + ' ' + timeStr;
}

// ================================================================
// FORMATER LE TEMPS (heures/minutes)
// ================================================================
function formatTime(minutes) {
    if (minutes < 60) return minutes + ' min';
    var hours = Math.floor(minutes / 60);
    var mins = minutes % 60;
    if (mins === 0) return hours + 'h';
    return hours + 'h ' + mins + 'min';
}

// ================================================================
// UPDATE TRACK STATS
// ================================================================
function updateTrackStats(distance, time, unit) {
    state.osrmData = { distance: distance, time: time, unit: unit };
    DOM.trackDistance.textContent = distance;
    var statLabel = document.querySelector('.track-stat:first-child .track-stat-label');
    if (statLabel) statLabel.textContent = unit;
    DOM.trackTime.textContent = time;
}

// ================================================================
// TRACER L'ITINÉRAIRE AVEC GRAPHHOPPER
// ================================================================
async function traceRouteGraphHopper() {
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

    var dist = calculateHaversine(lat1, lng1, lat2, lng2);
    if (dist < 0.02) {
        toast('📍 Vous êtes sur place', 'info', 3000);
        DOM.trackDistance.textContent = '0';
        DOM.trackTime.textContent = '0 min';
        return;
    }

    try {
        DOM.trackActionBtn.disabled = true;
        DOM.trackBtnLabel.textContent = '⏳ Tracé en cours...';

        var profile = getGraphHopperProfile();
        
        var url = GRAPHHOPPER_URL +
            '?point=' + lat1 + ',' + lng1 +
            '&point=' + lat2 + ',' + lng2 +
            '&profile=' + profile +
            '&locale=fr' +
            '&instructions=true' +
            '&calc_points=true' +
            '&points_encoded=false' +
            '&key=' + GRAPHHOPPER_KEY;

        console.log('🌐 GraphHopper:', url);

        var response = await fetch(url);

        if (!response.ok) {
            var errText = await response.text();
            console.error('❌ Erreur GraphHopper:', response.status, errText);
            throw new Error('Erreur GraphHopper: ' + response.status);
        }

        var data = await response.json();

        if (!data.paths || data.paths.length === 0) {
            throw new Error('Aucun itinéraire trouvé');
        }

        var path = data.paths[0];

        var distanceKm = path.distance / 1000;
        var timeMin = Math.round(path.time / 60000);

        var distanceDisplay;
        var unit;

        if (distanceKm < 1) {
            var meters = Math.round(path.distance);
            distanceDisplay = String(meters);
            unit = 'm';
        } else {
            distanceDisplay = distanceKm.toFixed(1);
            unit = 'km';
        }

        state.osrmData = {
            distance: distanceDisplay,
            time: formatTime(Math.max(1, timeMin)),
            unit: unit
        };

        DOM.trackDistance.textContent = distanceDisplay;
        var statLabel = document.querySelector('.track-stat:first-child .track-stat-label');
        if (statLabel) statLabel.textContent = unit;
        DOM.trackTime.textContent = formatTime(Math.max(1, timeMin));

        var coordinates = path.points.coordinates.map(function(coord) {
            return [coord[0], coord[1]];
        });

        drawRoute(coordinates);

        var geoInfo = await getLocationInfo(lat2, lng2);
        if (geoInfo) {
            updateGeoInfo(geoInfo, state.following);
            console.log('✅ Infos géographiques:', geoInfo.display_name);
        } else {
            console.warn('⚠️ Aucune info géographique trouvée');
            updateGeoInfo({
                display_name: 'Non disponible',
                road: 'Non disponible',
                suburb: 'Non disponible',
                city: 'Non disponible',
                country: 'Non disponible'
            }, state.following);
        }

        saveFollowingState();

        toast('✅ Itinéraire tracé (GraphHopper)', 'success', 2000);

    } catch (e) {
        console.error('❌ Erreur traçage:', e);
        toast('❌ ' + e.message, 'error', 3000);
    } finally {
        DOM.trackActionBtn.disabled = false;
        DOM.trackBtnLabel.textContent = '🗺️ Tracer l\'itinéraire';
    }
}

// ================================================================
// CALCUL HAVERSINE (distance en km)
// ================================================================
function calculateHaversine(lat1, lng1, lat2, lng2) {
    var R = 6371;
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLng = (lng2 - lng1) * Math.PI / 180;
    var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// ================================================================
// OUVRIR DANS GOOGLE MAPS
// ================================================================
function openInMaps() {
    if (!state.following) {
        toast('⚠️ Aucune personne suivie', 'error', 3000);
        return;
    }
    var lat = state.following.lat;
    var lng = state.following.lng;
    if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) {
        toast('⚠️ Position non disponible', 'error', 3000);
        return;
    }
    var url = 'https://www.google.com/maps?q=' + lat + ',' + lng;
    window.open(url, '_blank');
}

// ================================================================
// SLIDER DE SUIVI (3 slides)
// ================================================================
function openTrackSlider(record) {
    DOM.trackEmail.textContent = '📧 ' + record.email;
    
    if (state.osrmData && state.osrmData.distance !== '--') {
        DOM.trackDistance.textContent = state.osrmData.distance;
        var statLabel = document.querySelector('.track-stat:first-child .track-stat-label');
        if (statLabel) statLabel.textContent = state.osrmData.unit;
        DOM.trackTime.textContent = state.osrmData.time;
    } else {
        DOM.trackDistance.textContent = '--';
        DOM.trackTime.textContent = '--';
    }
    
    DOM.trackBtnLabel.textContent = '🗺️ Tracer l\'itinéraire';
    DOM.trackActionBtn.className = 'track-btn';
    state.isTracking = false;
    state.routeDrawn = false;
    state.slideIndex = 0;

    updateTimestamp(record.last_update || new Date().toISOString());
    DOM.trackSlider.classList.add('active');

    if (state.geoInfo && state.geoInfo.display_name) {
        updateGeoInfo(state.geoInfo, record);
    } else {
        updateGeoInfo({
            display_name: '--',
            road: '--',
            suburb: '--',
            city: '--',
            country: '--'
        }, record);
    }

    if (DOM.btnGeoRefresh) {
        DOM.btnGeoRefresh.disabled = false;
        DOM.btnGeoRefresh.innerHTML = '<i class="fas fa-sync-alt"></i> Récupérer les infos du lieu';
        DOM.btnGeoRefresh.onclick = function() {
            refreshGeoInfo();
        };
    }

    DOM.trackActionBtn.onclick = function() {
        traceRouteGraphHopper();
    };

    DOM.trackClose.onclick = function() {
        DOM.trackSlider.classList.remove('active');
    };

    if (DOM.btnOpenMaps) {
        DOM.btnOpenMaps.onclick = function() {
            openInMaps();
        };
    }

    updateTrackDots(0);

    DOM.trackSlides.addEventListener('scroll', function() {
        var slideWidth = this.offsetWidth || 300;
        var index = Math.round(this.scrollLeft / slideWidth);
        var total = DOM.trackDots.querySelectorAll('.dot').length;
        if (index >= 0 && index < total) {
            updateTrackDots(index);
        }
    });
}

function updateTrackDots(activeIndex) {
    var dots = DOM.trackDots.querySelectorAll('.dot');
    dots.forEach(function(dot, i) {
        dot.classList.toggle('active', i === activeIndex);
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
// "JE SUIS OÙ ?" — SLIDER
// ================================================================
function openWhereAmI() {
    DOM.whereSlider.classList.add('active');
    DOM.whereLoader.style.display = 'flex';
    DOM.whereInfo.style.display = 'none';

    if (!navigator.geolocation) {
        DOM.whereLoader.style.display = 'none';
        DOM.whereInfo.style.display = 'block';
        DOM.whereFullAddress.textContent = 'Géolocalisation non disponible';
        DOM.whereSuburb.textContent = '--';
        DOM.whereCity.textContent = '--';
        DOM.whereCountry.textContent = '--';
        DOM.whereRoad.textContent = '--';
        toast('⚠️ Géolocalisation non disponible', 'error');
        return;
    }

    navigator.geolocation.getCurrentPosition(
        function(pos) {
            var lat = pos.coords.latitude;
            var lng = pos.coords.longitude;
            state.whereData.lat = lat;
            state.whereData.lng = lng;
            getWhereAddress(lat, lng);
        },
        function(err) {
            DOM.whereLoader.style.display = 'none';
            DOM.whereInfo.style.display = 'block';
            DOM.whereFullAddress.textContent = 'Erreur GPS: ' + err.message;
            DOM.whereSuburb.textContent = '--';
            DOM.whereCity.textContent = '--';
            DOM.whereCountry.textContent = '--';
            DOM.whereRoad.textContent = '--';
            toast('⚠️ Erreur GPS: ' + err.message, 'error');
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
}

async function getWhereAddress(lat, lng) {
    try {
        var url = 'https://nominatim.openstreetmap.org/reverse' +
            '?lat=' + lat +
            '&lon=' + lng +
            '&format=json' +
            '&zoom=16' +
            '&addressdetails=1';

        var response = await fetch(url);
        if (!response.ok) throw new Error('Erreur Nominatim');

        var data = await response.json();

        DOM.whereLoader.style.display = 'none';
        DOM.whereInfo.style.display = 'block';

        var address = data.display_name || 'Adresse non disponible';
        var road = (data.address && data.address.road) || (data.address && data.address.street) || '--';
        var suburb = (data.address && data.address.suburb) || (data.address && data.address.neighbourhood) || (data.address && data.address.quarter) || '--';
        var city = (data.address && data.address.city) || (data.address && data.address.town) || (data.address && data.address.village) || '--';
        var country = (data.address && data.address.country) || '--';

        state.whereData.address = address;
        state.whereData.road = road;
        state.whereData.suburb = suburb;
        state.whereData.city = city;
        state.whereData.country = country;

        DOM.whereFullAddress.textContent = address;
        DOM.whereSuburb.textContent = suburb;
        DOM.whereCity.textContent = city;
        DOM.whereCountry.textContent = country;
        DOM.whereRoad.textContent = road;

    } catch (e) {
        console.error('❌ Erreur Nominatim:', e);
        DOM.whereLoader.style.display = 'none';
        DOM.whereInfo.style.display = 'block';
        DOM.whereFullAddress.textContent = 'Erreur récupération adresse';
        DOM.whereSuburb.textContent = '--';
        DOM.whereCity.textContent = '--';
        DOM.whereCountry.textContent = '--';
        DOM.whereRoad.textContent = '--';
    }
}

function closeWhereAmI() {
    DOM.whereSlider.classList.remove('active');
}

function whereOpenMaps() {
    var lat = state.whereData.lat;
    var lng = state.whereData.lng;
    if (!lat || !lng) {
        toast('⚠️ Position non disponible', 'error');
        return;
    }
    var url = 'https://www.google.com/maps?q=' + lat + ',' + lng;
    window.open(url, '_blank');
}

function whereCenterMap() {
    var lat = state.whereData.lat;
    var lng = state.whereData.lng;
    if (!lat || !lng) {
        toast('⚠️ Position non disponible', 'error');
        return;
    }
    if (state.map) {
        state.map.flyTo({ center: [lng, lat], zoom: 16 });
        closeWhereAmI();
        toast('📍 Centré sur votre position', 'info');
    }
}

// ================================================================
// MISE À JOUR - VÉRIFICATION VIA GITHUB
// ================================================================
function checkForUpdate() {
    toast('🔄 Vérification des mises à jour...', 'info', 3000);
    
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
            
            console.log('📅 Dernier commit GitHub:', lastCommitDate);
            console.log('📅 Date stockée localement:', storedDate);
            
            if (storedDate !== lastCommitDate) {
                // Nouvelle version disponible
                toast('🔄 Nouvelle version disponible ! Mise à jour en cours...', 'info', 3000);
                performUpdate(lastCommitDate);
            } else {
                toast('✅ Aucune mise à jour disponible', 'success', 3000);
            }
        })
        .catch(function(error) {
            console.error('❌ Erreur vérification mise à jour:', error);
            toast('⚠️ Impossible de vérifier les mises à jour: ' + error.message, 'error', 4000);
        });
}

function performUpdate(newCommitDate) {
    // 1. Vider localStorage (sauf la date du commit pour éviter la boucle)
    localStorage.clear();
    
    // 2. Sauvegarder la nouvelle date
    localStorage.setItem('last_commit_date', newCommitDate);
    
    // 3. Vider les caches du Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then(function(reg) {
            if (reg) {
                // Forcer la mise à jour du Service Worker
                reg.update();
                
                // Supprimer tous les caches
                caches.keys().then(function(cacheNames) {
                    cacheNames.forEach(function(cacheName) {
                        caches.delete(cacheName);
                        console.log('🗑️ Cache supprimé:', cacheName);
                    });
                });
            }
        });
    }
    
    // 4. Recharger la page après un court délai
    toast('🔄 Application mise à jour, redémarrage...', 'info', 2000);
    setTimeout(function() {
        window.location.reload(true);
    }, 1500);
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
async function init() {
    console.log('🚀 Initialisation de l\'application...');
    console.log('🗺️ Carte: OpenStreetMap');
    console.log('🧭 Itinéraire: GraphHopper');
    console.log('📍 Suivi GPS: watchPosition() en continu');
    console.log('🔄 Mise à jour: Vérification via GitHub');
    cacheDom();
    checkAuth();
    
    state.selectedCategories = loadSelectedCategories();
    renderCategories();
    
    // Démarrer le suivi GPS en continu
    startWatchingPosition();
    
    initMap();
    initSearch();
    initFollowToggle();
    initDropdown();
    initFollow();
    initHeaderButtons();

    // WHERE EVENTS
    if (DOM.whereClose) {
        DOM.whereClose.addEventListener('click', closeWhereAmI);
    }

    if (DOM.whereMapsBtn) {
        DOM.whereMapsBtn.addEventListener('click', whereOpenMaps);
    }

    if (DOM.whereCenterBtn) {
        DOM.whereCenterBtn.addEventListener('click', whereCenterMap);
    }

    DOM.whereSlider.addEventListener('click', function(e) {
        if (e.target === this) {
            closeWhereAmI();
        }
    });

    if (DOM.resetCategories) {
        DOM.resetCategories.addEventListener('click', resetCategories);
    }

    if (DOM.btnCenterFollow) {
        DOM.btnCenterFollow.classList.add('disabled');
    }

    registerServiceWorker();

    console.log('🏠 easily by megane — prêt');
    console.log('🔐 Authentifié:', state.isAuthenticated);
    console.log('📌 Catégories sélectionnées:', [...state.selectedCategories]);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}