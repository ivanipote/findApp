'use strict';

// ================================================================
// 🔑 CONFIGURATION SUPABASE
// ================================================================
var SUPABASE_URL = 'https://slanrdeaxapzfqtuqhbf.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsYW5yZGVheGFwemZxdHVxaGJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzMzA3OTcsImV4cCI6MjEwMDkwNjc5N30.pUCb_N-66pjFs-QP2RefsqjAnffC4Rbq-rP9qHfnvK8';

// ================================================================
// DOM REFS
// ================================================================
var DOM = {};

function cacheDom() {
    DOM = {
        backBtn: document.getElementById('backBtn'),
        placesContainer: document.getElementById('placesContainer'),
        sliderOverlay: document.getElementById('sliderOverlay'),
        sliderClose: document.getElementById('sliderClose'),
        sliderTitle: document.getElementById('sliderTitle'),
        sliderSlides: document.getElementById('sliderSlides'),
        sliderDots: document.getElementById('sliderDots'),
        placeToggle: document.getElementById('placeToggle'),
        btnDelete: document.getElementById('btnDelete'),
        toastEl: document.getElementById('toastMespos'),
        photo1: document.getElementById('photo1'),
        photo2: document.getElementById('photo2')
    };
}

// ================================================================
// ÉTAT
// ================================================================
var state = {
    currentPlaceId: null,
    allPlaces: [],
    toastTimer: null
};

// ================================================================
// TOAST
// ================================================================
function showToast(message, type) {
    var el = DOM.toastEl;
    if (!el) return;
    el.textContent = message;
    el.className = 'toast-mespos show ' + type;
    if (state.toastTimer) clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(function() {
        el.classList.remove('show');
    }, 2500);
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

// ================================================================
// CATÉGORIES
// ================================================================
function getCategoryInfo(categoryId) {
    var categories = {
        'boutiques': { label: 'Boutique', icon: 'fa-store' },
        'restaurants': { label: 'Restaurant', icon: 'fa-utensils' },
        'domiciles': { label: 'Domicile', icon: 'fa-house' },
        'cybercafes': { label: 'Cybercafé', icon: 'fa-laptop' },
        'sante': { label: 'Santé', icon: 'fa-heart-pulse' },
        'stations': { label: 'Station', icon: 'fa-gas-pump' }
    };
    return categories[categoryId] || { label: 'Non défini', icon: 'fa-location-dot' };
}

// ================================================================
// CHARGER LES LIEUX AVEC PHOTOS
// ================================================================
async function loadPlaces() {
    var session = getSession();
    if (!session || !session.access_token) {
        DOM.placesContainer.innerHTML =
            '<div class="empty-state">' +
            '<i class="fas fa-lock"></i>' +
            '<div class="empty-title">Connectez-vous</div>' +
            '<div class="empty-sub">Veuillez vous connecter pour voir vos positions</div>' +
            '</div>';
        return;
    }

    try {
        var token = session.access_token;

        // 1. Récupérer les lieux
        var response = await fetch(
            SUPABASE_URL + '/rest/v1/position?user_id=eq.' + session.user.id + '&order=created_at.desc', {
                headers: getHeaders(token)
            }
        );

        if (!response.ok) {
            if (response.status === 401) {
                showToast('Session expirée, veuillez vous reconnecter', 'error');
                return;
            }
            throw new Error('Erreur ' + response.status);
        }

        var places = await response.json();

        if (!places || places.length === 0) {
            DOM.placesContainer.innerHTML =
                '<div class="empty-state">' +
                '<i class="fas fa-map-marker-alt"></i>' +
                '<div class="empty-title">Aucune position</div>' +
                '<div class="empty-sub">Ajoutez votre premier lieu depuis "Add place"</div>' +
                '</div>';
            state.allPlaces = [];
            return;
        }

        // 2. Récupérer les photos
        var placeIds = places.map(function(p) { return p.id; });
        var idsString = placeIds.map(function(id) { return '"' + id + '"'; }).join(',');

        var photosResponse = await fetch(
            SUPABASE_URL + '/rest/v1/photos?select=*&position_id=in.(' + idsString + ')', {
                headers: getHeaders(token)
            }
        );

        var photos = photosResponse.ok ? await photosResponse.json() : [];

        // 3. Associer les photos
        var photosByPlace = {};
        photos.forEach(function(photo) {
            if (!photosByPlace[photo.position_id]) {
                photosByPlace[photo.position_id] = [];
            }
            photosByPlace[photo.position_id].push(photo);
        });

        places.forEach(function(place) {
            place.photos = photosByPlace[place.id] || [];
        });

        state.allPlaces = places;
        renderPlaces(state.allPlaces);

    } catch (e) {
        console.error('❌ Erreur chargement:', e);
        showToast('Erreur: ' + e.message, 'error');
    }
}

// ================================================================
// AFFICHER LES LIEUX
// ================================================================
function renderPlaces(places) {
    var html = '';
    places.forEach(function(place) {
        var cat = getCategoryInfo(place.category);
        var statusClass = place.status === 'open' ? 'open' : 'closed';
        var statusLabel = place.status === 'open' ? 'Ouvert' : 'Fermé';
        var statusIcon = place.status === 'open' ? 'fa-check-circle' : 'fa-times-circle';
        var date = place.created_at ? new Date(place.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';

        html +=
            '<div class="place-card-wrapper" data-id="' + place.id + '">' +
            '<div class="place-card">' +
            '<div class="place-top">' +
            '<span class="place-name"><i class="fas ' + cat.icon + '"></i> ' + place.name + '</span>' +
            '<span class="place-arrow"><i class="fas fa-chevron-right"></i></span>' +
            '</div>' +
            '<div class="place-address"><i class="fas fa-map-pin"></i> ' + (place.address || 'Adresse non renseignée') + '</div>' +
            '<div class="place-footer">' +
            '<span class="footer-item badge-category"><i class="fas fa-tag"></i> ' + cat.label + '</span>' +
            '<span class="footer-item status ' + statusClass + '"><i class="fas ' + statusIcon + '"></i> ' + statusLabel + '</span>' +
            '<span class="footer-item date-box"><i class="fas fa-calendar-alt"></i> ' + date + '</span>' +
            '</div>' +
            '</div>' +
            '</div>';
    });

    DOM.placesContainer.innerHTML = html;

    document.querySelectorAll('.place-card-wrapper').forEach(function(wrapper) {
        wrapper.addEventListener('click', function() {
            var id = this.dataset.id;
            var place = state.allPlaces.find(function(p) { return p.id === id; });
            if (place) {
                openSlider(place);
            }
        });
    });
}

// ================================================================
// SLIDER
// ================================================================
function openSlider(place) {
    state.currentPlaceId = place.id;
    var cat = getCategoryInfo(place.category);
    DOM.sliderTitle.innerHTML = '<i class="fas ' + cat.icon + '"></i> ' + place.name;

    var isActive = place.status === 'open';
    DOM.placeToggle.classList.toggle('active', isActive);

    var photos = place.photos || [];

    if (photos.length > 0) {
        DOM.photo1.innerHTML = '<img src="' + photos[0].url + '" alt="Photo 1" />';
    } else {
        DOM.photo1.innerHTML = '<div class="no-photo"><i class="fas fa-image"></i>Aucune photo</div>';
    }

    if (photos.length > 1) {
        DOM.photo2.innerHTML = '<img src="' + photos[1].url + '" alt="Photo 2" />';
    } else {
        DOM.photo2.innerHTML = '<div class="no-photo"><i class="fas fa-image"></i>Aucune photo</div>';
    }

    DOM.sliderSlides.scrollLeft = 0;
    updateDots(0);
    DOM.sliderOverlay.classList.add('active');
}

function closeSlider() {
    DOM.sliderOverlay.classList.remove('active');
}

function updateDots(activeIndex) {
    var dots = DOM.sliderDots.querySelectorAll('.dot');
    dots.forEach(function(dot, i) {
        dot.classList.toggle('active', i === activeIndex);
    });
}

// ================================================================
// TOGGLE STATUS
// ================================================================
async function togglePlaceStatus(id, active) {
    var session = getSession();
    if (!session || !session.access_token) {
        showToast('Veuillez vous connecter', 'error');
        return;
    }

    try {
        var status = active ? 'open' : 'closed';
        var response = await fetch(SUPABASE_URL + '/rest/v1/position?id=eq.' + id, {
            method: 'PATCH',
            headers: getHeaders(session.access_token),
            body: JSON.stringify({ status: status })
        });

        if (!response.ok) {
            if (response.status === 401) {
                showToast('Session expirée', 'error');
                return;
            }
            throw new Error('Erreur ' + response.status);
        }

        showToast(active ? '✅ Lieu activé' : '❌ Lieu désactivé', 'success');
        await loadPlaces();

    } catch (e) {
        console.error('❌ Erreur toggle:', e);
        showToast('Erreur: ' + e.message, 'error');
    }
}

// ================================================================
// SUPPRIMER
// ================================================================
async function deletePlace(id) {
    var session = getSession();
    if (!session || !session.access_token) {
        showToast('Veuillez vous connecter', 'error');
        return;
    }

    if (!confirm('Supprimer définitivement ce lieu ? Cette action est irréversible.')) {
        return;
    }

    try {
        var response = await fetch(SUPABASE_URL + '/rest/v1/position?id=eq.' + id, {
            method: 'DELETE',
            headers: getHeaders(session.access_token)
        });

        if (!response.ok) {
            if (response.status === 401) {
                showToast('Session expirée', 'error');
                return;
            }
            throw new Error('Erreur ' + response.status);
        }

        showToast('🗑️ Lieu supprimé', 'success');
        closeSlider();
        await loadPlaces();

    } catch (e) {
        console.error('❌ Erreur suppression:', e);
        showToast('Erreur: ' + e.message, 'error');
    }
}

// ================================================================
// INITIALISATION DES ÉVÉNEMENTS
// ================================================================
function initEvents() {
    DOM.backBtn.addEventListener('click', function() {
        window.history.back();
    });

    DOM.sliderClose.addEventListener('click', closeSlider);

    DOM.sliderOverlay.addEventListener('click', function(e) {
        if (e.target === this) {
            closeSlider();
        }
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeSlider();
        }
    });

    // Dots
    DOM.sliderDots.querySelectorAll('.dot').forEach(function(dot) {
        dot.addEventListener('click', function() {
            var index = parseInt(this.dataset.index);
            var slideWidth = DOM.sliderSlides.offsetWidth || 300;
            DOM.sliderSlides.scrollLeft = index * slideWidth;
            updateDots(index);
        });
    });

    // Scroll des slides → dots
    DOM.sliderSlides.addEventListener('scroll', function() {
        var slideWidth = this.offsetWidth || 300;
        var index = Math.round(this.scrollLeft / slideWidth);
        var total = DOM.sliderDots.querySelectorAll('.dot').length;
        if (index >= 0 && index < total) {
            updateDots(index);
        }
    });

    // Toggle
    DOM.placeToggle.addEventListener('click', function() {
        var isActive = this.classList.toggle('active');
        if (state.currentPlaceId) {
            togglePlaceStatus(state.currentPlaceId, isActive);
        }
    });

    // Supprimer
    DOM.btnDelete.addEventListener('click', function() {
        if (state.currentPlaceId) {
            deletePlace(state.currentPlaceId);
        }
    });
}

// ================================================================
// INIT
// ================================================================
function init() {
    console.log('📍 Mes positions - Séparé');
    cacheDom();
    initEvents();
    loadPlaces();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}