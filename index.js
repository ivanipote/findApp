'use strict';

// ================================================================
// 🔑 CONFIGURATION SUPABASE
// ================================================================
var SUPABASE_URL = 'https://slanrdeaxapzfqtuqhbf.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsYW5yZGVheGFwemZxdHVxaGJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzMzA3OTcsImV4cCI6MjEwMDkwNjc5N30.pUCb_N-66pjFs-QP2RefsqjAnffC4Rbq-rP9qHfnvK8';

// ================================================================
// 🔑 CONFIGURATION OPENROUTESERVICE
// ================================================================
var ORS_API_KEY = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjA5N2E1MDIxNmU5ZTQ5NTViMGU5OWM1ZTFmOTFjOTYzIiwiaCI6Im11cm11cjY0In0=';
var ORS_BASE_URL = 'https://api.openrouteservice.org';
var ORS_PROFILE = 'driving-car';

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
    routingControl: null,
    following: null,
    followChannel: null,
    trackMarker: null,
    trackPolyline: null,
    isTracking: false,
    isFollowingActive: false
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
        categoriesGrid: document.getElementById('categoriesGrid'),
        resetCategories: document.getElementById('resetCategories'),
        categoriesSection: document.getElementById('categoriesSection'),
        map: document.getElementById('map'),
        toggleFollow: document.getElementById('toggleFollow'),
        posStatus: document.getElementById('posStatus'),
        toast: document.getElementById('toast'),
        btnCenterMe: document.getElementById('btnCenterMe'),
        btnCenterFollow: document.getElementById('btnCenterFollow'),
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
// GEOLOCALISATION
// ================================================================
var watchId = null;

function getPosition() {
    if (!navigator.geolocation) {
        state.userLat = 5.3599517;
        state.userLng = -3.9792253;
        return;
    }
    navigator.geolocation.getCurrentPosition(
        function(pos) {
            state.userLat = pos.coords.latitude;
            state.userLng = pos.coords.longitude;
            if (DOM.posStatus) DOM.posStatus.textContent = '✓';
            updateUserMarker(state.userLat, state.userLng);
            if (state.isFollowingActive && map) {
                map.setView([state.userLat, state.userLng], 15);
            }
        },
        function(err) {
            state.userLat = 5.3599517;
            state.userLng = -3.9792253;
            if (DOM.posStatus) DOM.posStatus.textContent = '⚠️';
        }, {
            enableHighAccuracy: true,
            timeout: 10000
        }
    );
}

// ================================================================
// MAP
// ================================================================
var map = null;
var userMarker = null;
var trackMarker = null;

function initMap() {
    if (typeof L === 'undefined') {
        console.warn('⚠️ Leaflet non chargé');
        return;
    }

    map = L.map(DOM.map, {
        center: [state.userLat || 5.3599517, state.userLng || -3.9792253],
        zoom: 14,
        zoomControl: true,
        attributionControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    // Marqueur utilisateur : point avec halo
    userMarker = L.marker([state.userLat || 5.3599517, state.userLng || -3.9792253], {
        icon: L.divIcon({
            className: 'user-marker',
            html: '<div class="user-pulse"><div class="user-dot"></div></div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        })
    }).addTo(map);
    userMarker.bindPopup('📍 Ma position');

    setTimeout(function() { map.invalidateSize(); }, 400);
}

function updateUserMarker(lat, lng) {
    if (!userMarker) return;
    userMarker.setLatLng([lat, lng]);
    if (DOM.posStatus) DOM.posStatus.textContent = '✓';
    state.userLat = lat;
    state.userLng = lng;
    
    if (state.isFollowingActive && map) {
        map.setView([lat, lng], 15);
    }
    
    if (state.following) {
        updateTrackStats(state.following.lat, state.following.lng);
    }
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
// CENTRER LA CARTE
// ================================================================
function centerOnMe() {
    if (!state.userLat || !state.userLng) {
        toast('📍 Position non disponible', 'error', 3000);
        return;
    }
    if (map) {
        map.setView([state.userLat, state.userLng], 15);
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
    if (map) {
        map.setView([state.following.lat, state.following.lng], 15);
        toast('👤 Centré sur la personne suivie', 'info', 1500);
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
            timestamp: Date.now()
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

    // Add place → redirection vers add.html
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

    // Mon compte → me.html / login.html
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

    // ✅ Mes positions → mespositions.html
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
}

// ================================================================
// BOUTONS CENTRAGE
// ================================================================
function initCenterButtons() {
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
            if (state.userLat && state.userLng && map) {
                map.setView([state.userLat, state.userLng], 15);
            }
            getPosition();
        } else {
            toast('📍 Suivi GPS désactivé', 'info', 1500);
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
        userId: record.user_id
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
        map.removeLayer(state.trackPolyline);
        state.trackPolyline = null;
    }

    if (state.routingControl) {
        if (typeof state.routingControl.remove === 'function') {
            state.routingControl.remove();
        }
        state.routingControl = null;
    }

    if (trackMarker) {
        map.removeLayer(trackMarker);
        trackMarker = null;
    }

    state.following = null;
    state.isTracking = false;

    DOM.navFollowLabel.textContent = 'Suivre quelqu\'un';
    DOM.navFollow.querySelector('i').className = 'fas fa-eye';
    DOM.trackSlider.classList.remove('active');

    clearFollowingState();

    if (DOM.btnCenterFollow) {
        DOM.btnCenterFollow.classList.add('disabled');
    }

    toast('🛑 Suivi arrêté', 'info', 2000);
}

function showTrackMarker(lat, lng, email) {
    if (trackMarker) {
        map.removeLayer(trackMarker);
        trackMarker = null;
    }

    // Marqueur de suivi : pin classique
    var icon = L.divIcon({
        className: 'track-marker',
        html: '<div class="track-pin"><i class="fas fa-map-pin" style="color:#e74c3c;font-size:32px;text-shadow:0 2px 8px rgba(0,0,0,0.3);"></i></div>',
        iconSize: [32, 32],
        iconAnchor: [16, 32]
    });

    trackMarker = L.marker([lat, lng], { icon: icon }).addTo(map);
    trackMarker.bindPopup('📍 ' + email);

    trackMarker.on('click', function() {
        if (state.following) {
            openTrackSlider(state.following);
        }
    });

    map.setView([lat, lng], 14);
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
                }

                if (trackMarker) {
                    trackMarker.setLatLng([newData.latitude, newData.longitude]);
                    if (state.isTracking) {
                        updateTrackStats(newData.latitude, newData.longitude);
                    }
                }

                updateTimestamp(newData.last_update);
                saveFollowingState();
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
        }

        if (trackMarker) {
            trackMarker.setLatLng([newData.latitude, newData.longitude]);
            if (state.isTracking) {
                updateTrackStats(newData.latitude, newData.longitude);
            }
        }

        updateTimestamp(newData.last_update);
        saveFollowingState();

    } catch (e) {
        console.warn('⚠️ Erreur polling:', e);
    }
}

// ================================================================
// RAFRAÎCHIR LA POSITION SUIVIE
// ================================================================
async function refreshFollowingPosition() {
    if (!state.following) {
        toast('⚠️ Aucune personne suivie', 'error', 3000);
        return;
    }

    try {
        DOM.trackActionBtn.disabled = true;
        DOM.trackBtnLabel.textContent = '⏳ Mise à jour...';

        var session = getSession();
        var token = session ? session.access_token : null;

        var response = await fetch(
            SUPABASE_URL + '/rest/v1/shared_locations?id=eq.' + state.following.id + '&select=*&limit=1', {
                headers: getHeaders(token)
            }
        );

        if (!response.ok) {
            if (response.status === 401) {
                toast('🔐 Session expirée, veuillez restaurer votre session', 'error', 3000);
                return;
            }
            throw new Error('Erreur ' + response.status);
        }

        var data = await response.json();

        if (!data || data.length === 0) {
            toast('⚠️ Position non trouvée', 'error', 3000);
            return;
        }

        var newData = data[0];

        if (newData.active === false) {
            toast('⚠️ La personne a arrêté de partager sa position', 'error', 3000);
            stopFollowing();
            return;
        }

        state.following.lat = newData.latitude;
        state.following.lng = newData.longitude;

        if (trackMarker) {
            trackMarker.setLatLng([newData.latitude, newData.longitude]);
        }

        updateTimestamp(newData.last_update);
        updateTrackStats(newData.latitude, newData.longitude);

        // Effacer l'ancien itinéraire
        if (state.trackPolyline) {
            map.removeLayer(state.trackPolyline);
            state.trackPolyline = null;
        }

        if (state.routingControl) {
            if (typeof state.routingControl.remove === 'function') {
                state.routingControl.remove();
            }
            state.routingControl = null;
        }

        calculateRoute();
        saveFollowingState();

        toast('✅ Position mise à jour', 'success', 2000);

    } catch (e) {
        console.error('❌ Erreur rafraîchissement:', e);
        toast('❌ Erreur: ' + e.message, 'error', 3000);
    } finally {
        DOM.trackActionBtn.disabled = false;
        DOM.trackBtnLabel.textContent = 'Mettre à jour';
    }
}

// ================================================================
// RESTAURER LE SUIVI
// ================================================================
function restoreFollowing() {
    var saved = loadFollowingState();
    if (!saved) return;

    console.log('🔄 Restauration du suivi:', saved.email);

    if (!map) {
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
        userId: saved.userId
    };

    DOM.navFollowLabel.textContent = 'Arrêter de suivre';
    DOM.navFollow.querySelector('i').className = 'fas fa-stop-circle';

    showTrackMarker(saved.lat, saved.lng, saved.email);
    openTrackSlider({
        id: saved.id,
        code: saved.code,
        email: saved.email,
        lat: saved.lat,
        lng: saved.lng,
        userId: saved.userId
    });

    subscribeToFollow(saved.id);
    updateTimestamp();

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
        dateStr = updateTime.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
    } else {
        timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        dateStr = now.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
    }

    timestampEl.textContent = '⏱️ Dernière mise à jour : ' + dateStr + ' ' + timeStr;
}

// ================================================================
// SLIDER DE SUIVI
// ================================================================
function openTrackSlider(record) {
    DOM.trackEmail.textContent = '📧 ' + record.email;
    DOM.trackDistance.textContent = '--';
    DOM.trackTime.textContent = '--';
    DOM.trackBtnLabel.textContent = 'Mettre à jour';
    DOM.trackActionBtn.className = 'track-btn tracking';
    state.isTracking = false;

    updateTimestamp();
    DOM.trackSlider.classList.add('active');

    updateTrackStats(record.lat, record.lng);

    DOM.trackActionBtn.onclick = function() {
        refreshFollowingPosition();
    };

    DOM.trackClose.onclick = function() {
        DOM.trackSlider.classList.remove('active');
    };
}

function updateTrackStats(lat, lng) {
    if (!state.userLat || !state.userLng) return;

    var lat1 = state.userLat;
    var lng1 = state.userLng;
    var lat2 = lat;
    var lng2 = lng;

    var R = 6371;
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLng = (lng2 - lng1) * Math.PI / 180;
    var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    var distance = R * c;

    if (distance < 1) {
        var meters = Math.round(distance * 1000);
        DOM.trackDistance.textContent = meters;
        document.querySelector('.track-stat:first-child .track-stat-label').textContent = 'Mètres';
    } else {
        DOM.trackDistance.textContent = distance.toFixed(1);
        document.querySelector('.track-stat:first-child .track-stat-label').textContent = 'Km';
    }

    var time = Math.max(1, Math.round(distance / 5 * 60));
    DOM.trackTime.textContent = time;
}

function calculateRoute() {
    if (!state.following) return;

    var lat1 = state.userLat || 5.3599517;
    var lng1 = state.userLng || -3.9792253;
    var lat2 = state.following.lat;
    var lng2 = state.following.lng;

    if (isNaN(lat2) || isNaN(lng2) || lat2 === 0 || lng2 === 0) {
        toast('⚠️ Position non disponible', 'error', 3000);
        return;
    }

    // Nettoyer l'ancien itinéraire
    if (state.trackPolyline) {
        map.removeLayer(state.trackPolyline);
        state.trackPolyline = null;
    }

    if (state.routingControl) {
        if (typeof state.routingControl.remove === 'function') {
            state.routingControl.remove();
        }
        state.routingControl = null;
    }

    var R = 6371;
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLng = (lng2 - lng1) * Math.PI / 180;
    var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    var distance = R * c;

    if (distance < 1) {
        var meters = Math.round(distance * 1000);
        DOM.trackDistance.textContent = meters;
        document.querySelector('.track-stat:first-child .track-stat-label').textContent = 'Mètres';
    } else {
        DOM.trackDistance.textContent = distance.toFixed(1);
        document.querySelector('.track-stat:first-child .track-stat-label').textContent = 'Km';
    }

    var time = Math.max(1, Math.round(distance / 5 * 60));
    DOM.trackTime.textContent = time;

    if (distance < 0.05) {
        toast('📍 Vous êtes à ' + Math.round(distance * 1000) + ' mètres', 'info', 3000);
        DOM.trackBtnLabel.textContent = 'Mettre à jour';
        DOM.trackActionBtn.className = 'track-btn tracking';
        DOM.trackActionBtn.disabled = false;
        state.isTracking = true;
        return;
    }

    var url = ORS_BASE_URL + '/v2/directions/' + ORS_PROFILE + '/geojson' +
        '?api_key=' + ORS_API_KEY +
        '&start=' + lng1 + ',' + lat1 +
        '&end=' + lng2 + ',' + lat2;

    DOM.trackActionBtn.disabled = true;
    DOM.trackBtnLabel.textContent = 'Calcul...';

    fetch(url)
        .then(function(response) {
            if (!response.ok) throw new Error('Erreur ORS: ' + response.status);
            return response.json();
        })
        .then(function(data) {
            if (!data.features || data.features.length === 0) {
                throw new Error('Aucun itinéraire trouvé');
            }

            var feature = data.features[0];
            var summary = feature.properties.summary;
            var distanceRoute = (summary.distance / 1000).toFixed(1);
            var timeRoute = Math.round(summary.duration / 60);

            if (distanceRoute < 1) {
                DOM.trackDistance.textContent = Math.round(summary.distance);
                document.querySelector('.track-stat:first-child .track-stat-label').textContent = 'Mètres';
            } else {
                DOM.trackDistance.textContent = distanceRoute;
                document.querySelector('.track-stat:first-child .track-stat-label').textContent = 'Km';
            }
            DOM.trackTime.textContent = Math.max(1, timeRoute);

            var coordinates = feature.geometry.coordinates.map(function(coord) {
                return [coord[1], coord[0]];
            });

            state.trackPolyline = L.polyline(coordinates, {
                color: '#1976d2',
                weight: 4,
                opacity: 0.8
            }).addTo(map);

            map.fitBounds(state.trackPolyline.getBounds(), { padding: [50, 50] });

            state.routingControl = {
                remove: function() {
                    map.removeLayer(state.trackPolyline);
                }
            };

            state.isTracking = true;
            DOM.trackBtnLabel.textContent = 'Mettre à jour';
            DOM.trackActionBtn.className = 'track-btn tracking';
            DOM.trackActionBtn.disabled = false;

            toast('✅ Itinéraire tracé', 'success', 2000);
        })
        .catch(function(error) {
            console.warn('⚠️ Erreur OpenRouteService:', error);
            toast('❌ Erreur: ' + error.message, 'error', 3000);
            DOM.trackActionBtn.disabled = false;
            DOM.trackBtnLabel.textContent = 'Mettre à jour';
        });
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
    cacheDom();
    checkAuth();
    
    state.selectedCategories = loadSelectedCategories();
    renderCategories();
    
    getPosition();
    initMap();
    initSearch();
    initFollowToggle();
    initDropdown();
    initFollow();
    initCenterButtons();

    if (DOM.resetCategories) {
        DOM.resetCategories.addEventListener('click', resetCategories);
    }

    if (DOM.btnCenterFollow) {
        DOM.btnCenterFollow.classList.add('disabled');
    }

    setTimeout(function() {
        restoreFollowing();
    }, 1000);

    registerServiceWorker();

    console.log('🏠 easily by megane — prêt (PWA)');
    console.log('🔐 Authentifié:', state.isAuthenticated);
    console.log('📌 Catégories sélectionnées:', [...state.selectedCategories]);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}