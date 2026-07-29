'use strict';

// ================================================================
// 🔑 CONFIGURATION SUPABASE
// ================================================================
var SUPABASE_URL = 'https://slanrdeaxapzfqtuqhbf.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsYW5yZGVheGFwemZxdHVxaGJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzMzA3OTcsImV4cCI6MjEwMDkwNjc5N30.pUCb_N-66pjFs-QP2RefsqjAnffC4Rbq-rP9qHfnvK8';

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
    selectedCategories: new Set(CATEGORIES.map(function(c) { return c.id; })),
    userLat: null,
    userLng: null,
    places: [],
    photoFiles: [],
    routingControl: null,
    following: null,
    followChannel: null,
    trackMarker: null,
    trackPolyline: null,
    isTracking: false
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
        categoriesGrid: document.getElementById('categoriesGrid'),
        resetCategories: document.getElementById('resetCategories'),
        categoriesSection: document.getElementById('categoriesSection'),
        map: document.getElementById('map'),
        toggleFollow: document.getElementById('toggleFollow'),
        posStatus: document.getElementById('posStatus'),
        toast: document.getElementById('toast'),
        addOverlay: document.getElementById('addOverlay'),
        closeAdd: document.getElementById('closeAdd'),
        addForm: document.getElementById('addForm'),
        placeName: document.getElementById('placeName'),
        placeCategory: document.getElementById('placeCategory'),
        placeAddress: document.getElementById('placeAddress'),
        placePhone: document.getElementById('placePhone'),
        placeHours: document.getElementById('placeHours'),
        placeDescription: document.getElementById('placeDescription'),
        placePhotos: document.getElementById('placePhotos'),
        photoPreview: document.getElementById('photoPreview'),
        photoLabel: document.getElementById('photoLabel'),
        photoBtn: document.getElementById('photoBtn'),
        placeStatusToggle: document.getElementById('placeStatusToggle'),
        placeStatusText: document.getElementById('placeStatusText'),
        placeShare: document.getElementById('placeShare'),
        submitBtn: document.getElementById('submitBtn'),
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
// UPLOAD PHOTO
// ================================================================
async function uploadPhoto(file, placeId, token) {
    var parts = file.name.split('.');
    var ext = parts.length > 1 ? parts.pop() : 'jpg';
    var fileName = placeId + '_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6) + '.' + ext;

    var formData = new FormData();
    formData.append('file', file);

    var response = await fetch(SUPABASE_URL + '/storage/v1/object/place-photos/' + fileName, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': 'Bearer ' + token
        },
        body: formData
    });

    if (!response.ok) {
        var err = await response.text();
        throw new Error('Upload échoué: ' + response.status + ' - ' + err);
    }

    return SUPABASE_URL + '/storage/v1/object/public/place-photos/' + fileName;
}

// ================================================================
// CHARGER LES LIEUX
// ================================================================
async function loadPlaces() {
    try {
        var places = await apiFetch('/rest/v1/position?select=*&order=created_at.desc', { method: 'GET' });
        if (!places || places.length === 0) {
            state.places = [];
            filterMarkers();
            return;
        }

        var placeIds = places.map(function(p) { return p.id; });
        var idsString = placeIds.map(function(id) { return '"' + id + '"'; }).join(',');
        var photos = await apiFetch('/rest/v1/photos?select=*&position_id=in.(' + idsString + ')', { method: 'GET' });

        var photosByPlace = {};
        if (photos && photos.length > 0) {
            photos.forEach(function(photo) {
                if (!photosByPlace[photo.position_id]) {
                    photosByPlace[photo.position_id] = [];
                }
                photosByPlace[photo.position_id].push(photo);
            });
        }

        places.forEach(function(place) {
            place.photos = photosByPlace[place.id] || [];
        });

        state.places = places;
        filterMarkers();
    } catch (e) {
        console.warn('⚠️ Erreur chargement lieux:', e);
        state.places = [];
        filterMarkers();
    }
}

// ================================================================
// CATÉGORIES
// ================================================================
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
    renderCategories();
    filterMarkers();
}

function resetCategories() {
    state.selectedCategories = new Set(CATEGORIES.map(function(c) { return c.id; }));
    renderCategories();
    filterMarkers();
}

// ================================================================
// GEOLOCALISATION
// ================================================================
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
var markerLayer = null;
var markers = [];

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

    userMarker = L.marker([state.userLat || 5.3599517, state.userLng || -3.9792253], {
        icon: L.divIcon({
            className: 'user-marker',
            html: '<i class="fas fa-circle" style="color:#1976d2;font-size:16px;"></i>',
            iconSize: [16, 16],
            iconAnchor: [8, 8]
        })
    }).addTo(map);
    userMarker.bindPopup('📍 Position actuelle');

    markerLayer = L.layerGroup().addTo(map);

    setTimeout(function() { map.invalidateSize(); }, 400);
}

function updateUserMarker(lat, lng) {
    if (!userMarker) return;
    userMarker.setLatLng([lat, lng]);
    if (DOM.posStatus) DOM.posStatus.textContent = '✓';
    state.userLat = lat;
    state.userLng = lng;
    if (DOM.toggleFollow && DOM.toggleFollow.classList.contains('active')) {
        map.setView([lat, lng], 14);
    }
}

function addMarker(place) {
    if (!map || !markerLayer) return;
    var lat = parseFloat(place.lat);
    var lng = parseFloat(place.lng);
    if (isNaN(lat) || isNaN(lng)) return;

    var cat = CATEGORIES.find(function(c) { return c.id === place.category; });
    var color = cat ? cat.color : '#1976d2';
    var icon = cat ? cat.icon : 'fa-location-dot';

    var marker = L.marker([lat, lng], {
        icon: L.divIcon({
            className: 'place-marker',
            html: '<i class="fas ' + icon + '" style="color:' + color + ';font-size:22px;text-shadow:0 2px 4px rgba(0,0,0,0.2);"></i>',
            iconSize: [22, 22],
            iconAnchor: [11, 22]
        })
    }).addTo(markerLayer);

    marker.bindPopup('<strong>' + place.name + '</strong><br>' + (place.address || ''));

    marker.on('click', function() {
        redirectToInfo(place.id);
    });

    markers.push({ marker: marker, place: place });
    return marker;
}

function filterMarkers() {
    if (!markerLayer) return;
    markerLayer.clearLayers();
    markers = [];
    state.places.forEach(function(place) {
        if (state.selectedCategories.has(place.category)) {
            addMarker(place);
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
// PHOTO PREVIEW
// ================================================================
function renderPhotoPreview() {
    var preview = DOM.photoPreview;
    var label = DOM.photoLabel;
    if (!preview) return;
    preview.innerHTML = '';
    if (state.photoFiles.length === 0) {
        if (label) label.textContent = 'Aucun fichier';
        return;
    }
    if (label) {
        label.textContent = state.photoFiles.length === 1 ? state.photoFiles[0].name : state.photoFiles.length + ' photos';
    }

    state.photoFiles.forEach(function(file, index) {
        if (!file.type.startsWith('image/')) return;
        var reader = new FileReader();
        reader.onload = function(e) {
            var div = document.createElement('div');
            div.className = 'preview-item';
            div.innerHTML =
                '<img src="' + e.target.result + '" />' +
                '<button class="remove-photo" data-index="' + index + '" type="button"><i class="fas fa-times"></i></button>';
            div.querySelector('.remove-photo').addEventListener('click', function() {
                state.photoFiles.splice(index, 1);
                renderPhotoPreview();
                var dt = new DataTransfer();
                state.photoFiles.forEach(function(f) { dt.items.add(f); });
                if (DOM.placePhotos) DOM.placePhotos.files = dt.files;
            });
            preview.appendChild(div);
        };
        reader.readAsDataURL(file);
    });
}

// ================================================================
// OVERLAY AJOUT
// ================================================================
function initAddOverlay() {
    if (DOM.closeAdd) {
        DOM.closeAdd.addEventListener('click', function() {
            DOM.addOverlay.classList.remove('active');
            state.photoFiles = [];
            renderPhotoPreview();
        });
    }

    DOM.addOverlay.addEventListener('click', function(e) {
        if (e.target === this) {
            DOM.addOverlay.classList.remove('active');
            state.photoFiles = [];
            renderPhotoPreview();
        }
    });

    if (DOM.photoBtn) {
        DOM.photoBtn.addEventListener('click', function() {
            if (DOM.placePhotos) DOM.placePhotos.click();
        });
    }

    if (DOM.placePhotos) {
        DOM.placePhotos.addEventListener('change', function(e) {
            var files = Array.from(e.target.files);
            state.photoFiles = state.photoFiles.concat(files);
            renderPhotoPreview();
            var dt = new DataTransfer();
            state.photoFiles.forEach(function(f) { dt.items.add(f); });
            DOM.placePhotos.files = dt.files;
        });
    }

    if (DOM.placeStatusToggle) {
        DOM.placeStatusToggle.addEventListener('click', function() {
            var active = this.classList.toggle('active');
            DOM.placeStatusText.textContent = active ? 'Oui' : 'Non';
            DOM.placeStatusText.className = 'toggle-status ' + (active ? 'active' : 'inactive');
        });
    }

    if (DOM.addForm) {
        DOM.addForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            var session = getSession();
            if (!session || !session.access_token) {
                toast('🔐 Veuillez vous connecter', 'error', 3000);
                return;
            }

            var token = session.access_token;
            var name = DOM.placeName.value.trim();
            var category = DOM.placeCategory.value;
            var address = DOM.placeAddress.value.trim();
            var phone = DOM.placePhone.value.trim();
            var hours = DOM.placeHours.value.trim();
            var description = DOM.placeDescription.value.trim();
            var isActive = DOM.placeStatusToggle.classList.contains('active');

            if (!name || !category || !address) {
                toast('Veuillez remplir tous les champs obligatoires', 'error', 3000);
                return;
            }

            if (!DOM.placeShare.checked) {
                toast('Veuillez accepter de partager', 'error', 3000);
                return;
            }

            var data = {
                name: name,
                category: category,
                address: address,
                phone: phone || null,
                hours: hours || null,
                description: description || null,
                status: isActive ? 'open' : 'closed',
                lat: String(state.userLat || 5.3599517),
                lng: String(state.userLng || -3.9792253),
                user_id: session.user ? session.user.id : null
            };

            try {
                DOM.submitBtn.disabled = true;
                DOM.submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Envoi...';

                var insertResponse = await fetch(SUPABASE_URL + '/rest/v1/position', {
                    method: 'POST',
                    headers: {
                        ...getHeaders(token),
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify(data)
                });

                if (!insertResponse.ok) {
                    var errText = await insertResponse.text();
                    throw new Error('Insertion échouée: ' + insertResponse.status + ' - ' + errText);
                }

                var saved = await insertResponse.json();
                var placeId = null;
                if (Array.isArray(saved) && saved.length > 0 && saved[0].id) {
                    placeId = saved[0].id;
                } else if (saved && saved.id) {
                    placeId = saved.id;
                }

                if (!placeId) {
                    throw new Error('ID du lieu non récupéré');
                }

                var photoUrls = [];
                if (state.photoFiles.length > 0) {
                    toast('📸 Upload des photos...', 'info', 2000);
                    for (var i = 0; i < state.photoFiles.length; i++) {
                        try {
                            var url = await uploadPhoto(state.photoFiles[i], placeId, token);
                            photoUrls.push(url);
                        } catch (e) {
                            console.warn('⚠️ Photo échouée:', e.message);
                        }
                    }
                }

                if (photoUrls.length > 0) {
                    for (var j = 0; j < photoUrls.length; j++) {
                        var photoData = {
                            position_id: placeId,
                            url: photoUrls[j]
                        };
                        await fetch(SUPABASE_URL + '/rest/v1/photos', {
                            method: 'POST',
                            headers: {
                                ...getHeaders(token),
                                'Prefer': 'return=representation'
                            },
                            body: JSON.stringify(photoData)
                        });
                    }
                }

                await loadPlaces();

                DOM.addOverlay.classList.remove('active');
                DOM.addForm.reset();
                state.photoFiles = [];
                renderPhotoPreview();
                DOM.placeStatusToggle.className = 'toggle-switch active';
                DOM.placeStatusText.textContent = 'Oui';
                DOM.placeStatusText.className = 'toggle-status active';

                toast('✅ "' + name + '" ajouté avec ' + photoUrls.length + ' photo(s) !', 'success', 3000);

            } catch (error) {
                console.error('❌ Erreur:', error);
                toast('Erreur: ' + error.message, 'error', 4000);
            } finally {
                DOM.submitBtn.disabled = false;
                DOM.submitBtn.innerHTML = '<i class="fas fa-check"></i> VALIDER';
            }
        });
    }
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

            // ✅ VÉRIFIER : Si c'est son propre code
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
}

function stopFollowing() {
    if (state.followChannel) {
        state.followChannel.unsubscribe();
        state.followChannel = null;
    }

    if (state.trackMarker) {
        map.removeLayer(state.trackMarker);
        state.trackMarker = null;
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

    state.following = null;
    state.isTracking = false;

    DOM.navFollowLabel.textContent = 'Suivre quelqu\'un';
    DOM.navFollow.querySelector('i').className = 'fas fa-eye';
    DOM.trackSlider.classList.remove('active');

    toast('🛑 Suivi arrêté', 'info', 2000);
}

function showTrackMarker(lat, lng, email) {
    if (state.trackMarker) {
        map.removeLayer(state.trackMarker);
        state.trackMarker = null;
    }

    var icon = L.divIcon({
        className: 'track-marker',
        html: '<i class="fas fa-user" style="color:#e74c3c;font-size:28px;text-shadow:0 2px 8px rgba(0,0,0,0.3);"></i>',
        iconSize: [28, 28],
        iconAnchor: [14, 28]
    });

    state.trackMarker = L.marker([lat, lng], { icon: icon }).addTo(map);
    state.trackMarker.bindPopup('📍 ' + email);

    map.setView([lat, lng], 14);
}

function subscribeToFollow(recordId) {
    if (state.followChannel) {
        state.followChannel.unsubscribe();
        state.followChannel = null;
    }

    var supabaseChannel = new SupabaseChannel();

    state.followChannel = supabaseChannel
        .channel('shared_locations:' + recordId)
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

                if (state.trackMarker) {
                    state.trackMarker.setLatLng([newData.latitude, newData.longitude]);
                    if (state.isTracking) {
                        updateTrackStats(newData.latitude, newData.longitude);
                    }
                }
            }
        )
        .subscribe();
}

// ================================================================
// SLIDER DE SUIVI
// ================================================================
function openTrackSlider(record) {
    DOM.trackEmail.textContent = '📧 ' + record.email;
    DOM.trackDistance.textContent = '--';
    DOM.trackTime.textContent = '--';
    DOM.trackBtnLabel.textContent = 'Calculer l\'itinéraire';
    DOM.trackActionBtn.className = 'track-btn';
    state.isTracking = false;

    DOM.trackSlider.classList.add('active');

    updateTrackStats(record.latitude, record.longitude);

    DOM.trackActionBtn.onclick = function() {
        if (!state.isTracking) {
            calculateRoute();
        } else {
            updateRoute();
        }
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
    var time = Math.round(distance / 5 * 60);

    DOM.trackDistance.textContent = distance.toFixed(1);
    DOM.trackTime.textContent = time;
}

function calculateRoute() {
    if (!state.following) return;

    var lat1 = state.userLat || 5.3599517;
    var lng1 = state.userLng || -3.9792253;
    var lat2 = state.following.lat;
    var lng2 = state.following.lng;

    if (isNaN(lat2) || isNaN(lng2)) {
        toast('Position non disponible', 'error', 3000);
        return;
    }

    var url = 'https://router.project-osrm.org/route/v1/driving/' +
        lng1 + ',' + lat1 + ';' + lng2 + ',' + lat2 +
        '?overview=full&geometries=geojson';

    DOM.trackActionBtn.disabled = true;
    DOM.trackBtnLabel.textContent = 'Calcul...';

    fetch(url)
        .then(function(response) {
            if (!response.ok) throw new Error('Erreur OSM');
            return response.json();
        })
        .then(function(data) {
            if (!data.routes || data.routes.length === 0) {
                throw new Error('Aucun itinéraire trouvé');
            }

            var route = data.routes[0];
            var distance = (route.distance / 1000).toFixed(1);
            var time = Math.round(route.duration / 60);

            DOM.trackDistance.textContent = distance;
            DOM.trackTime.textContent = time;

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

            var coordinates = route.geometry.coordinates.map(function(coord) {
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
            console.warn('⚠️ Erreur OSM:', error);
            toast('Erreur: ' + error.message, 'error', 3000);
            DOM.trackActionBtn.disabled = false;
            DOM.trackBtnLabel.textContent = 'Calculer l\'itinéraire';
        });
}

function updateRoute() {
    calculateRoute();
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
            if (!state.isAuthenticated) {
                toast('🔐 Connectez-vous pour ajouter un lieu', 'error', 3000);
                return;
            }
            DOM.dropdownMenu.classList.remove('active');
            DOM.addOverlay.classList.add('active');
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
// FOLLOW TOGGLE
// ================================================================
function initFollowToggle() {
    if (!DOM.toggleFollow) return;
    DOM.toggleFollow.addEventListener('click', function() {
        this.classList.toggle('active');
        toast(this.classList.contains('active') ? '📍 Suivi activé' : 'Suivi désactivé', 'info', 1500);
    });
}

// ================================================================
// SUPABASE REALTIME (stub)
// ================================================================
function SupabaseChannel() {
    return {
        channel: function() { return this; },
        on: function() { return this; },
        subscribe: function() { return this; },
        unsubscribe: function() { return this; }
    };
}

// ================================================================
// INIT
// ================================================================
async function init() {
    console.log('🚀 Initialisation de l\'application...');
    cacheDom();
    checkAuth();
    renderCategories();
    getPosition();
    initMap();
    initSearch();
    initFollowToggle();
    initDropdown();
    initAddOverlay();
    initFollow();

    await loadPlaces();

    if (DOM.resetCategories) {
        DOM.resetCategories.addEventListener('click', resetCategories);
    }

    console.log('🏠 easily by megane — prêt');
    console.log('🔐 Authentifié:', state.isAuthenticated);
    console.log('📌 ' + state.places.length + ' lieux en mémoire');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}