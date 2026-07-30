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
        menuBtn: document.getElementById('menuBtn'),
        dropdownMenu: document.getElementById('dropdownMenu'),
        navPositions: document.getElementById('navPositions'),
        navRestore: document.getElementById('navRestore'),
        navLogout: document.getElementById('navLogout'),
        userEmail: document.getElementById('userEmail'),
        userPseudo: document.getElementById('userPseudo'),
        resetPseudoBtn: document.getElementById('resetPseudoBtn'),
        shareToggle: document.getElementById('shareToggle'),
        shareCode: document.getElementById('shareCode'),
        copyCodeBtn: document.getElementById('copyCodeBtn'),
        resetCodeBtn: document.getElementById('resetCodeBtn'),
        shareEmail: document.getElementById('shareEmail'),
        sendEmailBtn: document.getElementById('sendEmailBtn'),
        toggleModeBtn: document.getElementById('toggleModeBtn'),
        emailMode: document.getElementById('emailMode'),
        pseudoMode: document.getElementById('pseudoMode'),
        pseudoPrefix: document.getElementById('pseudoPrefix'),
        pseudoNumber: document.getElementById('pseudoNumber'),
        pseudoLetter: document.getElementById('pseudoLetter'),
        historyContent: document.getElementById('historyContent'),
        receivedBadge: document.getElementById('receivedBadge'),
        sentBadge: document.getElementById('sentBadge')
    };
}

// ================================================================
// NOTIFICATION DANS LE HEADER
// ================================================================
var headerTimer = null;
var originalEmail = '';

function showHeaderNotification(message, type) {
    var emailEl = DOM.userEmail;
    if (!emailEl) return;

    if (!originalEmail) {
        originalEmail = emailEl.textContent;
    }

    var icon = type === 'success' ? '✅' : (type === 'error' ? '❌' : 'ℹ️');
    emailEl.textContent = icon + ' ' + message;
    emailEl.style.color = type === 'success' ? '#2ecc71' : (type === 'error' ? '#d32f2f' : '#1976d2');

    if (headerTimer) clearTimeout(headerTimer);
    headerTimer = setTimeout(function() {
        emailEl.textContent = originalEmail;
        emailEl.style.color = '';
        originalEmail = '';
    }, 3500);
}

function showToast(message, type) {
    showHeaderNotification(message, type);
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

function refreshSession() {
    return new Promise(function(resolve, reject) {
        var session = getSession();
        if (!session || !session.refresh_token) {
            showToast('Aucune session à restaurer', 'error');
            reject('Aucun refresh_token');
            return;
        }

        fetch(SUPABASE_URL + '/auth/v1/token?grant_type=refresh_token', {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                refresh_token: session.refresh_token
            })
        })
        .then(function(response) {
            if (!response.ok) {
                throw new Error('Erreur ' + response.status);
            }
            return response.json();
        })
        .then(function(data) {
            var newSession = {
                access_token: data.access_token,
                refresh_token: data.refresh_token,
                expires_in: data.expires_in,
                user: data.user || session.user
            };

            localStorage.setItem('sb_user', JSON.stringify(newSession.user));
            localStorage.setItem('sb_session', JSON.stringify(newSession));

            console.log('✅ Session rafraîchie avec succès');
            showToast('Session restaurée avec succès', 'success');
            resolve(newSession);
        })
        .catch(function(error) {
            console.error('❌ Erreur rafraîchissement:', error);
            showToast('Session expirée, veuillez vous reconnecter', 'error');
            reject(error);
        });
    });
}

function logout() {
    localStorage.removeItem('sb_session');
    localStorage.removeItem('sb_user');
    showToast('Déconnecté', 'success');
    setTimeout(function() {
        window.location.href = 'login.html';
    }, 1200);
}

// ================================================================
// CODE - GÉNÉRATION
// ================================================================
function generateCode() {
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    var code = '';
    for (var i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
        if (i === 3) code += '-';
    }
    return code;
}

// ================================================================
// PSEUDO - GÉNÉRATION & GESTION
// ================================================================
function generatePseudo(email) {
    var prefix = email.substring(0, 2).toUpperCase();
    var number = String(Math.floor(Math.random() * 100)).padStart(2, '0');
    var letter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
    return prefix + '-' + number + letter;
}

async function isPseudoUnique(pseudo) {
    var session = getSession();
    if (!session || !session.access_token) return false;

    try {
        var response = await fetch(
            SUPABASE_URL + '/rest/v1/user_profiles?pseudo=eq.' + pseudo + '&select=id',
            { headers: getHeaders(session.access_token) }
        );
        var data = await response.json();
        return data.length === 0;
    } catch (e) {
        return false;
    }
}

async function generateUniquePseudo(email) {
    var attempts = 0;
    var maxAttempts = 100;

    while (attempts < maxAttempts) {
        var pseudo = generatePseudo(email);
        if (await isPseudoUnique(pseudo)) {
            return pseudo;
        }
        attempts++;
    }
    return null;
}

async function loadPseudo() {
    var session = getSession();
    if (!session || !session.access_token) {
        DOM.userPseudo.textContent = '--';
        return;
    }

    try {
        var response = await fetch(
            SUPABASE_URL + '/rest/v1/user_profiles?user_id=eq.' + session.user.id + '&select=pseudo&limit=1', {
                headers: getHeaders(session.access_token)
            }
        );
        if (!response.ok) {
            if (response.status === 401) {
                await refreshSession();
                return loadPseudo();
            }
            return;
        }
        var data = await response.json();

        if (data && data.length > 0 && data[0].pseudo) {
            DOM.userPseudo.textContent = data[0].pseudo;
        } else {
            var newPseudo = await generateUniquePseudo(session.user.email);
            if (newPseudo) {
                await savePseudo(session.user.id, newPseudo);
                DOM.userPseudo.textContent = newPseudo;
            }
        }
    } catch (e) {
        console.error('❌ Erreur chargement pseudo:', e);
    }
}

async function savePseudo(userId, pseudo) {
    try {
        var response = await fetch(SUPABASE_URL + '/rest/v1/user_profiles', {
            method: 'POST',
            headers: {
                ...getHeaders(),
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({
                user_id: userId,
                pseudo: pseudo
            })
        });

        if (!response.ok) {
            if (response.status === 401) {
                await refreshSession();
                return savePseudo(userId, pseudo);
            }
            throw new Error('Erreur sauvegarde pseudo');
        }

        return true;
    } catch (e) {
        console.error('❌ Erreur sauvegarde pseudo:', e);
        return false;
    }
}

async function resetPseudo() {
    var session = getSession();
    if (!session || !session.access_token) {
        showToast('Veuillez vous connecter', 'error');
        return;
    }

    try {
        var newPseudo = await generateUniquePseudo(session.user.email);
        if (!newPseudo) {
            showToast('Erreur génération pseudo', 'error');
            return;
        }

        var response = await fetch(
            SUPABASE_URL + '/rest/v1/user_profiles?user_id=eq.' + session.user.id,
            {
                method: 'PATCH',
                headers: getHeaders(session.access_token),
                body: JSON.stringify({ pseudo: newPseudo })
            }
        );

        if (!response.ok) {
            if (response.status === 401) {
                await refreshSession();
                return resetPseudo();
            }
            throw new Error('Erreur mise à jour pseudo');
        }

        DOM.userPseudo.textContent = newPseudo;
        showToast('🔄 Pseudo mis à jour : ' + newPseudo, 'success');

    } catch (e) {
        console.error('❌ Erreur reset pseudo:', e);
        showToast('Erreur: ' + e.message, 'error');
    }
}

// ================================================================
// CHARGER MON CODE
// ================================================================
async function loadMyCode() {
    var session = getSession();
    if (!session || !session.access_token) {
        DOM.userEmail.textContent = '📧 Non connecté';
        return;
    }

    DOM.userEmail.textContent = '📧 ' + session.user.email;

    try {
        var response = await fetch(
            SUPABASE_URL + '/rest/v1/shared_locations?user_id=eq.' + session.user.id +
            '&select=*&limit=1&order=created_at.desc', {
                headers: getHeaders(session.access_token)
            }
        );
        if (!response.ok) {
            if (response.status === 401) {
                await refreshSession();
                return loadMyCode();
            }
            return;
        }
        var data = await response.json();

        if (data && data.length > 0) {
            var record = data[0];
            currentRecordId = record.id;
            DOM.shareCode.textContent = record.code;
            DOM.shareToggle.classList.toggle('active', record.active === true);

            if (record.active) {
                startUpdatingLocation(record.id, session.user.id);
            }
        } else {
            DOM.shareCode.textContent = 'Aucun code';
            DOM.shareToggle.classList.remove('active');
        }
    } catch (e) {
        console.error('❌ Erreur chargement code:', e);
    }
}

// ================================================================
// CRÉER UN CODE
// ================================================================
async function createShareCode() {
    var session = getSession();
    if (!session || !session.access_token) {
        showToast('Veuillez vous connecter', 'error');
        return null;
    }

    var code = generateCode();
    var data = {
        user_id: session.user.id,
        code: code,
        email: session.user.email,
        latitude: 0,
        longitude: 0,
        active: true
    };

    try {
        var response = await fetch(SUPABASE_URL + '/rest/v1/shared_locations', {
            method: 'POST',
            headers: {
                ...getHeaders(session.access_token),
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            if (response.status === 401) {
                await refreshSession();
                return createShareCode();
            }
            var err = await response.text();
            throw new Error('Erreur ' + response.status + ': ' + err);
        }

        var result = await response.json();
        var record = result[0] || result;
        currentRecordId = record.id;
        DOM.shareCode.textContent = record.code;
        DOM.shareToggle.classList.add('active');

        startUpdatingLocation(record.id, session.user.id);

        showToast('Code créé : ' + record.code, 'success');
        return record;
    } catch (e) {
        console.error('❌ Erreur création code:', e);
        showToast('Erreur: ' + e.message, 'error');
        return null;
    }
}

// ================================================================
// RÉINITIALISER LE CODE
// ================================================================
async function resetShareCode() {
    if (!currentRecordId) {
        showToast('Aucun code à réinitialiser', 'error');
        return;
    }

    var session = getSession();
    if (!session || !session.access_token) {
        showToast('Veuillez vous connecter', 'error');
        return;
    }

    var newCode = generateCode();

    try {
        var response = await fetch(SUPABASE_URL + '/rest/v1/shared_locations?id=eq.' + currentRecordId, {
            method: 'PATCH',
            headers: getHeaders(session.access_token),
            body: JSON.stringify({ code: newCode })
        });

        if (!response.ok) {
            if (response.status === 401) {
                await refreshSession();
                return resetShareCode();
            }
            var err = await response.text();
            throw new Error('Erreur ' + response.status + ': ' + err);
        }

        DOM.shareCode.textContent = newCode;
        showToast('Code réinitialisé : ' + newCode, 'success');
    } catch (e) {
        console.error('❌ Erreur réinitialisation:', e);
        showToast('Erreur: ' + e.message, 'error');
    }
}

// ================================================================
// TOGGLE ACTIVE
// ================================================================
async function toggleShare(active) {
    if (!currentRecordId) {
        if (active) {
            await createShareCode();
        }
        return;
    }

    var session = getSession();
    if (!session || !session.access_token) {
        showToast('Veuillez vous connecter', 'error');
        return;
    }

    try {
        var response = await fetch(SUPABASE_URL + '/rest/v1/shared_locations?id=eq.' + currentRecordId, {
            method: 'PATCH',
            headers: getHeaders(session.access_token),
            body: JSON.stringify({ active: active })
        });

        if (!response.ok) {
            if (response.status === 401) {
                await refreshSession();
                return toggleShare(active);
            }
            var err = await response.text();
            throw new Error('Erreur ' + response.status + ': ' + err);
        }

        if (active) {
            showToast('Partage activé', 'success');
            var session2 = getSession();
            startUpdatingLocation(currentRecordId, session2.user.id);
        } else {
            showToast('Partage désactivé', 'info');
            if (watchId) {
                navigator.geolocation.clearWatch(watchId);
                watchId = null;
            }
        }
    } catch (e) {
        console.error('❌ Erreur toggle:', e);
        showToast('Erreur: ' + e.message, 'error');
    }
}

// ================================================================
// RÉCUPÉRER LA POSITION GPS
// ================================================================
function getUserPosition() {
    return new Promise(function(resolve) {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                function(pos) {
                    resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                },
                function() {
                    getPositionFromSupabase(resolve);
                },
                { enableHighAccuracy: true, timeout: 5000 }
            );
        } else {
            getPositionFromSupabase(resolve);
        }
    });
}

function getPositionFromSupabase(resolve) {
    var session = getSession();
    if (!session || !session.access_token) {
        resolve({ lat: 0, lng: 0 });
        return;
    }

    fetch(
        SUPABASE_URL + '/rest/v1/shared_locations?user_id=eq.' + session.user.id + '&select=latitude,longitude&limit=1&order=last_update.desc', {
            headers: getHeaders(session.access_token)
        }
    )
    .then(function(response) {
        if (!response.ok) return [];
        return response.json();
    })
    .then(function(data) {
        if (data && data.length > 0 && data[0].latitude && data[0].longitude) {
            resolve({ lat: data[0].latitude, lng: data[0].longitude });
        } else {
            resolve({ lat: 0, lng: 0 });
        }
    })
    .catch(function() {
        resolve({ lat: 0, lng: 0 });
    });
}

// ================================================================
// SUIVI GPS
// ================================================================
var watchId = null;
var currentRecordId = null;

function startUpdatingLocation(recordId, userId) {
    if (!navigator.geolocation) {
        console.warn('⚠️ Géolocalisation non disponible');
        return;
    }

    if (watchId) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }

    watchId = navigator.geolocation.watchPosition(
        async function(pos) {
            var lat = pos.coords.latitude;
            var lng = pos.coords.longitude;
            var accuracy = pos.coords.accuracy;

            var session = getSession();
            if (!session || !session.access_token) return;

            try {
                await fetch(SUPABASE_URL + '/rest/v1/shared_locations?id=eq.' + recordId, {
                    method: 'PATCH',
                    headers: getHeaders(session.access_token),
                    body: JSON.stringify({
                        latitude: lat,
                        longitude: lng,
                        accuracy: accuracy,
                        last_update: new Date().toISOString()
                    })
                });
            } catch (e) {
                console.warn('⚠️ Erreur mise à jour position:', e);
            }
        },
        function(err) {
            console.warn('⚠️ Erreur GPS:', err.message);
        }, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 5000
        }
    );
}

// ================================================================
// ENVOYER UN CODE PAR EMAIL
// ================================================================
async function sendCodeByEmail(receiverEmail) {
    var session = getSession();
    if (!session || !session.access_token) {
        showToast('Veuillez vous connecter', 'error');
        return;
    }

    var code = DOM.shareCode.textContent;
    if (code === 'Aucun code') {
        showToast('Générez un code d\'abord', 'error');
        return;
    }

    if (!receiverEmail || !receiverEmail.includes('@')) {
        showToast('Email invalide', 'error');
        return;
    }

    if (receiverEmail === session.user.email) {
        showToast('Vous ne pouvez pas vous envoyer un code à vous-même', 'error');
        return;
    }

    try {
        DOM.sendEmailBtn.disabled = true;
        DOM.sendEmailBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        var pos = await getUserPosition();
        var userLat = pos.lat || 0;
        var userLng = pos.lng || 0;

        var inviteData = {
            sender_id: session.user.id,
            sender_email: session.user.email,
            receiver_email: receiverEmail,
            code: code,
            status: 'pending',
            latitude: userLat,
            longitude: userLng
        };

        var inviteResponse = await fetch(SUPABASE_URL + '/rest/v1/shared_invites', {
            method: 'POST',
            headers: {
                ...getHeaders(session.access_token),
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(inviteData)
        });

        if (!inviteResponse.ok) {
            if (inviteResponse.status === 401) {
                await refreshSession();
                return sendCodeByEmail(receiverEmail);
            }
            var errText = await inviteResponse.text();
            throw new Error('Erreur enregistrement invitation: ' + errText);
        }

        showToast('✅ Code envoyé avec succès à ' + receiverEmail, 'success');
        DOM.shareEmail.value = '';

        await loadSentHistory();
        await loadReceivedHistory();

    } catch (e) {
        console.error('❌ Erreur envoi:', e);
        showToast('❌ Échec de l\'envoi', 'error');
        await loadSentHistory();
    } finally {
        DOM.sendEmailBtn.disabled = false;
        DOM.sendEmailBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
    }
}

// ================================================================
// ENVOYER UN CODE PAR PSEUDO (corrigé)
// ================================================================
async function sendCodeByPseudo(prefix, number, letter) {
    var session = getSession();
    if (!session || !session.access_token) {
        showToast('Veuillez vous connecter', 'error');
        return;
    }

    var code = DOM.shareCode.textContent;
    if (code === 'Aucun code') {
        showToast('Générez un code d\'abord', 'error');
        return;
    }

    if (!prefix || !number || !letter) {
        showToast('Pseudo incomplet', 'error');
        return;
    }

    var pseudo = prefix.toUpperCase() + '-' + number + letter.toUpperCase();

    try {
        DOM.sendEmailBtn.disabled = true;
        DOM.sendEmailBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        // ✅ Récupérer le user_id associé au pseudo
        var userResponse = await fetch(
            SUPABASE_URL + '/rest/v1/user_profiles?pseudo=eq.' + pseudo + '&select=user_id',
            { headers: getHeaders(session.access_token) }
        );

        if (!userResponse.ok) {
            throw new Error('Erreur recherche pseudo');
        }

        var userData = await userResponse.json();

        if (!userData || userData.length === 0) {
            showToast('❌ Pseudo inconnu', 'error');
            DOM.sendEmailBtn.disabled = false;
            DOM.sendEmailBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
            return;
        }

        var targetUserId = userData[0].user_id;

        // ✅ Récupérer l'email via shared_locations (si l'utilisateur a partagé)
        var emailResponse = await fetch(
            SUPABASE_URL + '/rest/v1/shared_locations?user_id=eq.' + targetUserId + '&select=email&limit=1',
            { headers: getHeaders(session.access_token) }
        );

        var receiverEmail = null;

        if (emailResponse.ok) {
            var emailData = await emailResponse.json();
            if (emailData && emailData.length > 0 && emailData[0].email) {
                receiverEmail = emailData[0].email;
            }
        }

        // ✅ Fallback : chercher dans shared_invites
        if (!receiverEmail) {
            var fallbackResponse = await fetch(
                SUPABASE_URL + '/rest/v1/shared_invites?sender_id=eq.' + targetUserId + '&select=sender_email&limit=1',
                { headers: getHeaders(session.access_token) }
            );
            if (fallbackResponse.ok) {
                var fallbackData = await fallbackResponse.json();
                if (fallbackData && fallbackData.length > 0 && fallbackData[0].sender_email) {
                    receiverEmail = fallbackData[0].sender_email;
                }
            }
        }

        if (!receiverEmail) {
            showToast('❌ Email du destinataire introuvable', 'error');
            DOM.sendEmailBtn.disabled = false;
            DOM.sendEmailBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
            return;
        }

        // ✅ Envoyer le code
        var pos = await getUserPosition();
        var userLat = pos.lat || 0;
        var userLng = pos.lng || 0;

        var inviteData = {
            sender_id: session.user.id,
            sender_email: session.user.email,
            receiver_email: receiverEmail,
            code: code,
            status: 'pending',
            latitude: userLat,
            longitude: userLng
        };

        var inviteResponse = await fetch(SUPABASE_URL + '/rest/v1/shared_invites', {
            method: 'POST',
            headers: {
                ...getHeaders(session.access_token),
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(inviteData)
        });

        if (!inviteResponse.ok) {
            if (inviteResponse.status === 401) {
                await refreshSession();
                return sendCodeByPseudo(prefix, number, letter);
            }
            var errText = await inviteResponse.text();
            throw new Error('Erreur enregistrement invitation: ' + errText);
        }

        showToast('✅ Code envoyé avec succès à ' + pseudo, 'success');

        DOM.pseudoPrefix.value = '';
        DOM.pseudoNumber.value = '';
        DOM.pseudoLetter.value = '';

        await loadSentHistory();
        await loadReceivedHistory();

    } catch (e) {
        console.error('❌ Erreur envoi par pseudo:', e);
        showToast('❌ Échec de l\'envoi', 'error');
    } finally {
        DOM.sendEmailBtn.disabled = false;
        DOM.sendEmailBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
    }
}

// ================================================================
// ALTERNANCE EMAIL / PSEUDO
// ================================================================
var isEmailMode = true;

function toggleSendMode() {
    isEmailMode = !isEmailMode;

    if (isEmailMode) {
        DOM.emailMode.style.display = 'block';
        DOM.pseudoMode.style.display = 'none';
        DOM.toggleModeBtn.innerHTML = '<i class="fas fa-exchange-alt"></i>';
        DOM.toggleModeBtn.title = 'Basculer vers Pseudo';
        DOM.shareEmail.focus();
    } else {
        DOM.emailMode.style.display = 'none';
        DOM.pseudoMode.style.display = 'block';
        DOM.toggleModeBtn.innerHTML = '<i class="fas fa-envelope"></i>';
        DOM.toggleModeBtn.title = 'Basculer vers Email';
        DOM.pseudoPrefix.focus();
    }
}

// ================================================================
// CHARGER L'HISTORIQUE DES ENVOIS
// ================================================================
async function loadSentHistory() {
    var session = getSession();
    if (!session || !session.access_token) return;

    try {
        var response = await fetch(
            SUPABASE_URL + '/rest/v1/shared_invites?sender_id=eq.' + session.user.id +
            '&order=sent_at.desc&limit=30', {
                headers: getHeaders(session.access_token)
            }
        );
        if (!response.ok) {
            if (response.status === 401) {
                await refreshSession();
                return loadSentHistory();
            }
            return;
        }
        var data = await response.json();

        var filteredData = data.filter(function(item) {
            if (!item.deleted_by) return true;
            return item.deleted_by !== session.user.id;
        });

        DOM.sentBadge.textContent = filteredData ? filteredData.length : 0;
        window._sentData = filteredData || [];

        var activeTab = document.querySelector('.tab.active');
        if (activeTab && activeTab.dataset.tab === 'sent') {
            renderHistory('sent');
        }

    } catch (e) {
        console.error('❌ Erreur chargement envois:', e);
        window._sentData = [];
    }
}

// ================================================================
// CHARGER L'HISTORIQUE DES RÉCEPTIONS
// ================================================================
async function loadReceivedHistory() {
    var session = getSession();
    if (!session || !session.access_token) return;

    try {
        var response = await fetch(
            SUPABASE_URL + '/rest/v1/shared_invites?receiver_email=eq.' + session.user.email +
            '&receiver_hidden=eq.false' +
            '&order=sent_at.desc&limit=30', {
                headers: getHeaders(session.access_token)
            }
        );
        if (!response.ok) {
            if (response.status === 401) {
                await refreshSession();
                return loadReceivedHistory();
            }
            return;
        }
        var data = await response.json();

        DOM.receivedBadge.textContent = data ? data.length : 0;
        window._receivedData = data || [];

        var activeTab = document.querySelector('.tab.active');
        if (activeTab && activeTab.dataset.tab === 'received') {
            renderHistory('received');
        }

    } catch (e) {
        console.error('❌ Erreur chargement réceptions:', e);
        window._receivedData = [];
    }
}

// ================================================================
// MASQUER UNE ENTRÉE (soft delete pour émetteur)
// ================================================================
async function hideHistoryItem(id) {
    var session = getSession();
    if (!session || !session.access_token) {
        showToast('Veuillez vous connecter', 'error');
        return;
    }

    try {
        var response = await fetch(SUPABASE_URL + '/rest/v1/shared_invites?id=eq.' + id, {
            method: 'PATCH',
            headers: getHeaders(session.access_token),
            body: JSON.stringify({
                deleted_by: session.user.id
            })
        });

        if (!response.ok) {
            if (response.status === 401) {
                await refreshSession();
                return hideHistoryItem(id);
            }
            var errText = await response.text();
            throw new Error('Erreur masquage: ' + errText);
        }

        showToast('🗑️ Entrée masquée', 'success');

        await loadSentHistory();
        await loadReceivedHistory();

        var activeTab = document.querySelector('.tab.active');
        if (activeTab) {
            renderHistory(activeTab.dataset.tab);
        }

    } catch (e) {
        console.error('❌ Erreur masquage:', e);
        showToast('❌ Erreur: ' + e.message, 'error');
    }
}

// ================================================================
// MASQUER UNE RÉCEPTION (soft delete pour récepteur)
// ================================================================
async function hideReceivedItem(id) {
    var session = getSession();
    if (!session || !session.access_token) {
        showToast('Veuillez vous connecter', 'error');
        return;
    }

    try {
        var response = await fetch(SUPABASE_URL + '/rest/v1/shared_invites?id=eq.' + id, {
            method: 'PATCH',
            headers: getHeaders(session.access_token),
            body: JSON.stringify({
                receiver_hidden: true
            })
        });

        if (!response.ok) {
            if (response.status === 401) {
                await refreshSession();
                return hideReceivedItem(id);
            }
            var errText = await response.text();
            throw new Error('Erreur masquage: ' + errText);
        }

        showToast('🗑️ Entrée masquée', 'success');

        await loadSentHistory();
        await loadReceivedHistory();

        var activeTab = document.querySelector('.tab.active');
        if (activeTab) {
            renderHistory(activeTab.dataset.tab);
        }

    } catch (e) {
        console.error('❌ Erreur masquage:', e);
        showToast('❌ Erreur: ' + e.message, 'error');
    }
}

// ================================================================
// RENDU DE L'HISTORIQUE
// ================================================================
function renderHistory(type) {
    var data = type === 'received' ? window._receivedData || [] : window._sentData || [];
    var iconClass = type === 'received' ? 'received' : 'sent';
    var iconHtml = type === 'received' ? '<i class="fas fa-inbox"></i>' : '<i class="fas fa-paper-plane"></i>';
    var iconColor = type === 'received' ? '#1976d2' : '#e67e22';

    if (data.length === 0) {
        DOM.historyContent.innerHTML =
            '<div class="empty-state">' +
            '<i class="fas ' + (type === 'received' ? 'fa-inbox' : 'fa-paper-plane') + '"></i>' +
            'Aucun code ' + (type === 'received' ? 'reçu' : 'envoyé') +
            '</div>';
        return;
    }

    var html = '';
    data.forEach(function(item) {
        var time = new Date(item.sent_at);
        var timeStr = time.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        var dateStr = time.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });

        var status = item.status || 'failed';
        var isSuccess = (status === 'pending' || status === 'success' || status === 'accepted');
        var statusClass = isSuccess ? 'success' : 'failed';
        var statusLabel = isSuccess ? 'Succès' : 'Échec';

        var emailDisplay = type === 'received'
            ? (item.sender_email || 'Inconnu')
            : item.receiver_email;

        var lat = item.latitude || 0;
        var lng = item.longitude || 0;

        html +=
            '<div class="history-item" data-id="' + item.id + '">' +

            '<div class="h-icon ' + iconClass + '" style="background:' + iconColor + ';">' + iconHtml + '</div>' +

            '<div class="h-info">' +
            '<div class="h-code">' + item.code + '</div>' +
            '<div class="h-email"><i class="fas fa-user"></i> ' + emailDisplay + '</div>' +
            '</div>' +

            '<span class="h-status ' + statusClass + '">' + statusLabel + '</span>' +

            '<span class="h-time">' + dateStr + ' ' + timeStr + '</span>' +

            '<div class="h-actions">' +
            '<button class="btn-action btn-copy-code" data-code="' + item.code + '">' +
            '<i class="fas fa-copy"></i> Copier' +
            '</button>' +
            '<button class="btn-action btn-maps" data-lat="' + lat + '" data-lng="' + lng + '">' +
            '<i class="fas fa-map-marker-alt"></i> Maps' +
            '</button>' +
            '<button class="btn-action btn-delete" data-id="' + item.id + '" data-type="' + type + '">' +
            '<i class="fas fa-trash"></i> Masquer' +
            '</button>' +
            '</div>' +

            '</div>';
    });

    DOM.historyContent.innerHTML = html;

    // Copier
    document.querySelectorAll('.btn-copy-code').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            var code = this.dataset.code;
            navigator.clipboard.writeText(code).then(function() {
                showToast('📋 Code copié : ' + code, 'success');
            }).catch(function() {
                var textarea = document.createElement('textarea');
                textarea.value = code;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                showToast('📋 Code copié', 'success');
            });
        });
    });

    // Maps
    document.querySelectorAll('.btn-maps').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            var lat = parseFloat(this.dataset.lat);
            var lng = parseFloat(this.dataset.lng);
            if (lat && lng && lat !== 0 && lng !== 0) {
                var url = 'https://www.google.com/maps?q=' + lat + ',' + lng;
                window.open(url, '_blank');
            } else {
                showToast('⚠️ Position non disponible', 'error');
            }
        });
    });

    // Masquer
    document.querySelectorAll('.btn-delete').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            var id = this.dataset.id;
            var type = this.dataset.type;

            if (confirm('Masquer cette entrée ?')) {
                if (type === 'received') {
                    hideReceivedItem(id);
                } else {
                    hideHistoryItem(id);
                }
            }
        });
    });
}

// ================================================================
// ÉVÉNEMENTS
// ================================================================
function initEvents() {
    DOM.backBtn.addEventListener('click', function() {
        window.history.back();
    });

    DOM.menuBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        DOM.dropdownMenu.classList.toggle('active');
    });

    document.addEventListener('click', function() {
        DOM.dropdownMenu.classList.remove('active');
    });

    DOM.navPositions.addEventListener('click', function() {
        DOM.dropdownMenu.classList.remove('active');
        window.location.href = 'mespositions.html';
    });

    DOM.navRestore.addEventListener('click', function() {
        DOM.dropdownMenu.classList.remove('active');
        refreshSession();
    });

    DOM.navLogout.addEventListener('click', function() {
        DOM.dropdownMenu.classList.remove('active');
        logout();
    });

    // Pseudo reset
    DOM.resetPseudoBtn.addEventListener('click', function() {
        resetPseudo();
    });

    // Toggle share
    DOM.shareToggle.addEventListener('click', function() {
        var isActive = this.classList.contains('active');
        var newState = !isActive;
        this.classList.toggle('active');
        toggleShare(newState);
    });

    // Copy code
    DOM.copyCodeBtn.addEventListener('click', function() {
        var code = DOM.shareCode.textContent;
        if (code === 'Aucun code') {
            showToast('Aucun code à copier', 'error');
            return;
        }
        navigator.clipboard.writeText(code).then(function() {
            var originalText = DOM.copyCodeBtn.innerHTML;
            DOM.copyCodeBtn.innerHTML = '<i class="fas fa-check"></i>';
            setTimeout(function() {
                DOM.copyCodeBtn.innerHTML = originalText;
            }, 2000);
            showToast('📋 Code copié : ' + code, 'success');
        }).catch(function() {
            var textarea = document.createElement('textarea');
            textarea.value = code;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            showToast('📋 Code copié', 'success');
        });
    });

    // Reset code
    DOM.resetCodeBtn.addEventListener('click', function() {
        if (!currentRecordId) {
            showToast('Aucun code à réinitialiser', 'error');
            return;
        }
        resetShareCode();
    });

    // Toggle mode
    DOM.toggleModeBtn.addEventListener('click', function() {
        toggleSendMode();
    });

    // Send button
    DOM.sendEmailBtn.addEventListener('click', function() {
        if (isEmailMode) {
            var email = DOM.shareEmail.value.trim();
            if (!email || !email.includes('@')) {
                showToast('Email invalide', 'error');
                return;
            }
            sendCodeByEmail(email);
        } else {
            var prefix = DOM.pseudoPrefix.value.trim().toUpperCase();
            var number = DOM.pseudoNumber.value.trim();
            var letter = DOM.pseudoLetter.value.trim().toUpperCase();

            if (!prefix || !number || !letter) {
                showToast('Pseudo incomplet', 'error');
                return;
            }
            sendCodeByPseudo(prefix, number, letter);
        }
    });

    // Auto-advance pseudo fields
    DOM.pseudoPrefix.addEventListener('input', function() {
        this.value = this.value.toUpperCase();
        if (this.value.length === 2) {
            DOM.pseudoNumber.focus();
        }
    });

    DOM.pseudoNumber.addEventListener('input', function() {
        this.value = this.value.replace(/\D/g, '').slice(0, 2);
        if (this.value.length === 2) {
            DOM.pseudoLetter.focus();
        }
    });

    DOM.pseudoLetter.addEventListener('input', function() {
        this.value = this.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 1);
        if (this.value.length === 1) {
            // Optionnel : auto-submit
        }
    });

    // Enter key on inputs
    DOM.shareEmail.addEventListener('keyup', function(e) {
        if (e.key === 'Enter') {
            DOM.sendEmailBtn.click();
        }
    });

    [DOM.pseudoPrefix, DOM.pseudoNumber, DOM.pseudoLetter].forEach(function(input) {
        input.addEventListener('keyup', function(e) {
            if (e.key === 'Enter') {
                DOM.sendEmailBtn.click();
            }
        });
    });

    // Tabs
    document.querySelectorAll('.tab').forEach(function(tab) {
        tab.addEventListener('click', function() {
            var parent = this.closest('.history-card');
            var allTabs = parent.querySelectorAll('.tab');
            allTabs.forEach(function(t) { t.classList.remove('active'); });
            this.classList.add('active');

            var type = this.dataset.tab;
            renderHistory(type);
        });
    });
}

// ================================================================
// INIT
// ================================================================
async function init() {
    console.log('👤 Mon Profil - Version complète');
    cacheDom();
    initEvents();

    var session = getSession();
    if (session && session.user) {
        originalEmail = '📧 ' + session.user.email;
    }

    // Charger pseudo
    await loadPseudo();

    // Charger code de partage
    await loadMyCode();

    // Charger historiques
    await loadSentHistory();
    await loadReceivedHistory();

    // Afficher reçus par défaut
    renderHistory('received');

    // Mode email par défaut
    isEmailMode = true;
    DOM.emailMode.style.display = 'block';
    DOM.pseudoMode.style.display = 'none';
    DOM.toggleModeBtn.innerHTML = '<i class="fas fa-exchange-alt"></i>';

    // Rafraîchir périodiquement
    setInterval(function() {
        loadSentHistory();
        loadReceivedHistory();
        var activeTab = document.querySelector('.tab.active');
        if (activeTab) {
            renderHistory(activeTab.dataset.tab);
        }
    }, 30000);
}

init();