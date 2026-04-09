
// ============================================
// NEXIUM AUTH & SUBSCRIPTION ENFORCEMENT
// ============================================
window.currentUser = null;
let currentRegisterUsername = "";

window.showRegisterForm = function() {
    document.getElementById('auth-form-container').style.display = 'none';
    document.getElementById('pin-form-container').style.display = 'none';
    document.getElementById('register-form-container').style.display = 'flex';
}

window.showLoginForm = function() {
    document.getElementById('register-form-container').style.display = 'none';
    document.getElementById('pin-form-container').style.display = 'none';
    document.getElementById('auth-form-container').style.display = 'flex';
}

window.showPinForm = function() {
    document.getElementById('auth-form-container').style.display = 'none';
    document.getElementById('register-form-container').style.display = 'none';
    document.getElementById('pin-form-container').style.display = 'flex';
}

window.registerNexium = async function() {
    const u = document.getElementById('reg-username').value;
    const e = document.getElementById('reg-email').value;
    const p1 = document.getElementById('reg-password').value;
    const p2 = document.getElementById('reg-password-confirm').value;
    
    const errEl = document.getElementById('reg-error');
    errEl.style.color = '#ef4444';
    
    if(!u || !e || !p1 || !p2) return errEl.innerText = "Error: Faltan datos";
    if(p1 !== p2) return errEl.innerText = "Error: Las contraseñas no coinciden";
    if(p1.length < 8) return errEl.innerText = "Error: Mínimo 8 caracteres";
    if(!/[.@!#$%^&*()_+{}\[\]:;<>,.?~\\-]/.test(p1)) return errEl.innerText = "Error: Debe contener un signo (., @, etc)";

    errEl.style.color = '#38bdf8';
    errEl.innerText = "Registrando y enviando PIN...";
    
    try {
        const res = await fetch("https://nexiumbrowser.com/api/register", {
            method: "POST", headers:{"Content-Type":"application/json"},
            body: JSON.stringify({username:u, password:p1, email:e})
        });
        const data = await res.json();
        if(res.ok) {
            currentRegisterUsername = u;
            errEl.innerText = "";
            showPinForm();
            document.getElementById('pin-error').style.color = '#10b981';
            document.getElementById('pin-error').innerText = data.message;
        } else {
            errEl.style.color = '#ef4444';
            errEl.innerText = data.error || "Error al registrar la cuenta";
        }
    } catch(err) {
        errEl.style.color = '#ef4444';
        errEl.innerText = "Error de conexión al servidor";
    }
}

window.verifyPinNexium = async function() {
    const pin = document.getElementById('pin-input').value;
    const errEl = document.getElementById('pin-error');
    errEl.style.color = '#ef4444';

    if(!pin || pin.length !== 4) return errEl.innerText = "Error: Introduce un PIN de 4 dígitos válido";
    if(!currentRegisterUsername) return errEl.innerText = "Error: Falta usuario. Regístrate de nuevo.";

    errEl.style.color = '#38bdf8';
    errEl.innerText = "Verificando...";
    
    try {
        const res = await fetch("https://nexiumbrowser.com/api/verify-pin", {
            method: "POST", headers:{"Content-Type":"application/json"},
            body: JSON.stringify({username: currentRegisterUsername, pin: pin})
        });
        const data = await res.json();
        if(res.ok) {
            errEl.innerText = "";
            // Setup session 
            window.currentUser = data.user;
            document.getElementById('auth-username').value = currentRegisterUsername; // auto fill login just in case
            
            document.getElementById("auth-overlay").style.display = "none";
            window.updateSidebarQuota();
            applyPremiumLocks();
            if (typeof window.loadProfiles === 'function') {
                window.loadProfiles();
            }
            
            Swal.fire({
                icon: 'success',
                title: 'Cuenta Creada',
                text: 'Bienvenido a Nexium Security. Tu cuenta se ha activado.',
                background: '#14151a',
                color: '#fff',
                confirmButtonColor: '#8b5cf6'
            });

        } else {
            errEl.style.color = '#ef4444';
            errEl.innerText = data.error || "PIN Inválido";
        }
    } catch(err) {
        errEl.style.color = '#ef4444';
        errEl.innerText = "Error al intentar verificar el PIN";
    }
}

window.loginNexium = async function() {
    const u = document.getElementById('auth-username').value;
    const p = document.getElementById('auth-password').value;
    const rem = document.getElementById('auth-remember').checked;
    const btn = document.getElementById('auth-btn');
    
    // Natively securely extract the desktop pc username
    let pcName = "Unknown PC";
    try {
        const usernameNative = require('os').userInfo().username;
        pcName = usernameNative;
    } catch(e) {}
    
    // Change text color to blue for informational message so it doesn't look like an error
    const errEl = document.getElementById('auth-error');
    errEl.style.color = '#38bdf8';
    errEl.innerText = "";
    
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i data-lucide="loader-2" class="spin" style="width: 18px; height: 18px;"></i> Authenticating...`;
        lucide.createIcons();
    }
    
    try {
        const res = await fetch("https://nexiumbrowser.com/api/login", {
            method: "POST", headers:{"Content-Type":"application/json"},
            body: JSON.stringify({username:u, password:p, pc_name: pcName})
        });
        const data = await res.json();
        if(res.ok) {
            window.currentUser = data.user;
            window.authToken = data.token;
            
            if(rem) {
                localStorage.setItem('nexium_auth_u', u);
                localStorage.setItem('nexium_auth_p', p);
            } else {
                localStorage.removeItem('nexium_auth_u');
                localStorage.removeItem('nexium_auth_p');
            }
            
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `Login`;
            }
            
            document.getElementById("auth-overlay").style.display = "none";
            window.updateSidebarQuota();
            applyPremiumLocks();
            errEl.innerText = "";
            if (typeof window.loadProfiles === 'function') {
                window.loadProfiles();
            }
        } else {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `Login`;
            }
            errEl.style.color = '#ef4444';
            errEl.innerText = data.error || "Invalid credentials";
        }
    } catch(e) {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `Login`;
        }
        errEl.style.color = '#ef4444';
        errEl.innerText = "Server under maintenance, please try again in a few minutes.";
    }
}

window.logoutNexium = function() {
    window.currentUser = null;
    localStorage.removeItem('nexium_auth_u');
    localStorage.removeItem('nexium_auth_p');
    document.getElementById("auth-username").value = "";
    document.getElementById("auth-password").value = "";
    document.getElementById("auth-overlay").style.display = "flex";
}

window.updateSidebarQuota = function() {
    if(!window.currentUser) return;
    const user = window.currentUser;
    
    const elBlock = document.getElementById('sidebar-user-block');
    const elUser = document.getElementById('sidebar-username');
    const elPlan = document.getElementById('sidebar-plan');
    const elQuota = document.getElementById('sidebar-quota');
    const elDot = document.getElementById('sidebar-status-dot');
    const elIcon = document.getElementById('sidebar-user-icon');
    
    if(elUser) elUser.innerText = user.username;
    
    // Admin nav logic
    const adminNav = document.getElementById('admin_nav');
    if(adminNav) {
        adminNav.style.display = (user.username.toLowerCase().trim() === 'gunif' || user.username.toLowerCase().trim() === 'admin') ? 'flex' : 'none';
    }
    
    // Calculate Plan & Days Left
    let planText = user.subscription_plan || user.plan || 'Free Tier';
    let dotColor = '#ef4444'; // default red (expired or error)
    let iconColor = 'var(--text-secondary)';
    
    let isTrial = planText.toLowerCase().includes('trial');
    let isActive = (user.subscription_active === 1 || user.subscription_active === true || user.subscription_active === '1');
    
    // Fallback sync with dashboard: if active but still says free, it is a Pro (due to old /buy API not updating plan name)
    if (isActive && !isTrial && (planText.toLowerCase().includes('free'))) {
        planText = 'Pro Tier';
    }
    
    let profilesLimitText = "5";
    
    if (isActive) {
        dotColor = isTrial ? '#fbbf24' : '#10b981'; // yellow for trial, green for pro active
        iconColor = isTrial ? '#fcd34d' : '#34d399';
        
        let daysLeftStr = "";
        if (user.subscription_end) {
            const end = new Date(user.subscription_end);
            const now = new Date();
            const diffTime = end.getTime() - now.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays > 0) {
                if (isTrial) {
                    daysLeftStr = ` · ${diffDays} days left`;
                } else {
                    daysLeftStr = ` · Active`;
                }
            } else {
                daysLeftStr = ` · Expiring soon`;
                dotColor = '#f97316'; // Orange
            }
        }
        
        if(elPlan) {
            elPlan.innerText = `${planText}${daysLeftStr}`;
            elPlan.style.color = isTrial ? '#fbbf24' : '#38bdf8';
        }
        if (planText !== 'Free Tier' && planText !== 'Free') {
            profilesLimitText = "Unlimited";
        }
    } else {
        if(elPlan) {
            elPlan.innerText = planText === 'Free Tier' ? 'Free Tier' : 'Expired';
            elPlan.style.color = '#94a3b8';
        }
    }
    
    // Profiles Used
    const count = window.allLoadedProfiles ? window.allLoadedProfiles.length : 0;
    let profilesText = `Profiles: ${count} / ${profilesLimitText}`;
    if (elQuota) elQuota.innerText = profilesText;
    
    // Collapse Tooltip Title
    if (elBlock) {
        elBlock.title = `User: ${user.username}\nPlan: ${elPlan ? elPlan.innerText : planText}\n${profilesText}`;
    }
    
    if (elDot) elDot.style.background = dotColor;
    if (elIcon) elIcon.style.color = iconColor;
    
    if(window.lucide) lucide.createIcons();
}

function applyPremiumLocks() {
    const tabs = document.querySelectorAll('.editor-tab');
    if(!tabs || tabs.length < 4) return;
    
    if(!window.currentUser || !window.currentUser.subscription_active) {
        tabs[0].innerHTML = `General <i data-lucide="lock" style="width:12px; height:12px; color:gray;"></i>`;
        tabs[2].innerHTML = `Platform <i data-lucide="lock" style="width:12px; height:12px; color:gray;"></i>`;
        tabs[3].innerHTML = `Advanced <i data-lucide="lock" style="width:12px; height:12px; color:gray;"></i>`;
        if(window.lucide) lucide.createIcons();
        
        const fpBtn = document.getElementById('btnNewFingerprint');
        if(fpBtn) fpBtn.style.opacity = '0.5';
    } else {
        tabs[0].innerHTML = `General`;
        tabs[2].innerHTML = `Platform`;
        tabs[3].innerHTML = `Advanced`;
        const fpBtn = document.getElementById('btnNewFingerprint');
        if(fpBtn) fpBtn.style.opacity = '1';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    
    // Auto fill credentials
    const savedU = localStorage.getItem('nexium_auth_u');
    const savedP = localStorage.getItem('nexium_auth_p');
    
    // Listen for Enter key on password input
    const pInput = document.getElementById('auth-password');
    if(pInput) {
        pInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                window.loginNexium();
            }
        });
    }

    if(savedU && savedP) {
        document.getElementById('auth-username').value = savedU;
        document.getElementById('auth-password').value = savedP;
        // Optionally auto-login: window.loginNexium();
    }

    if(typeof window.switchTab === 'function') {
        const originalSwitchTab = window.switchTab;
        window.switchTab = function(tabId) {
            if(!window.currentUser || !window.currentUser.subscription_active) {
                if(tabId === 'overview' || tabId === 'hardware' || tabId === 'advanced') {
                    Swal.fire({
                        title: 'Premium',
                        text: 'Necesitas plan PRO para modificar la huella de hardware.',
                        iconHtml: '<img src="NexiumIcon.png" style="width:50px;">',
                        showCancelButton: true,
                        confirmButtonText: 'Actualizar',
                        cancelButtonText: 'Cerrar',
                        confirmButtonColor: '#2563eb'
                    }).then((result) => {
                        if (result.isConfirmed) {
                            require('electron').shell.openExternal('https://nexiumbrowser.com/#pricing');
                        }
                    });
                    return; 
                }
            }
            originalSwitchTab(tabId);
        };
    }
    
    if(typeof window.openModal === 'function') {
        const originalOpenModal = window.openModal;
        window.openModal = function() {
            if(!window.currentUser || !window.currentUser.subscription_active) {
                const count = document.querySelectorAll('#profileList tr').length;
                if(count >= 5) {
                    Swal.fire('Atención', 'El plan gratuito permite máximo 5 perfiles.', 'warning');
                    return; 
                }
            }
            originalOpenModal();
        };
    }
    
    const fpBtn = document.getElementById('btnNewFingerprint');
    if(fpBtn) {
        const oldOnClick = fpBtn.onclick;
        fpBtn.onclick = function(e) {
            if(!window.currentUser || !window.currentUser.subscription_active) {
                Swal.fire('Premium', 'Generar huellas únicas automáticamente es exclusivo para usuarios registrados.', 'info');
                e.preventDefault();
                return false;
            }
            if(typeof oldOnClick === 'function') oldOnClick.call(fpBtn, e);
            else if(typeof window.generateNewFingerprint === 'function') window.generateNewFingerprint();
        }
    }
});


// ============================================
// Multi-Tenant Isolation & Groups Management
// ============================================

window.renderGroupsList = function() {
    const list = document.getElementById('groupList');
    if(!list) return;
    
    let groups = JSON.parse(localStorage.getItem(`nexium_groups_${window.currentUser?.username}`) || '["Default"]');
    if (!groups.includes("Default")) { groups.unshift("Default"); }
    
    let html = '';
    groups.forEach(g => {
        let count = 0;
        if(typeof allLoadedProfiles !== 'undefined') {
            count = allLoadedProfiles.filter(p => p.group === g || (!p.group && g === 'Default')).length;
        }
        
        let id_str = Math.random().toString(36).substring(2, 10);
        html += `
        <tr>
            <td><i data-lucide="grip-vertical" style="color:var(--text-muted); width:14px; height:14px; cursor:grab;"></i></td>
            <td>
                <div style="font-weight:600; color:#fff;">${g}</div>
                <div style="font-size:0.75rem; color:var(--text-muted);">${id_str}...</div>
            </td>
            <td>${count}</td>
            <td>0</td>
            <td>0</td>
            <td>
                <i data-lucide="cloud" style="color:#8b5cf6;" class="status-icon"></i>
                <i data-lucide="shield" style="color:#8b5cf6;" class="status-icon"></i>
            </td>
            <td>
                <button class="btn-icon" title="Delete Group" ${g==='Default'?'disabled':''} onclick="deleteGroup('${g}')"><i data-lucide="trash-2"></i></button>
            </td>
        </tr>`;
    });
    list.innerHTML = html;
    
    const select = document.getElementById('profileGroup');
    if(select) {
        select.innerHTML = groups.map(g => `<option value="${g}">${g}</option>`).join('');
    }
    
    if(typeof lucide !== 'undefined') lucide.createIcons();
}

window.createNewGroup = function() {
    Swal.fire({
        title: 'Create Group',
        input: 'text',
        inputPlaceholder: 'Enter group name...',
        showCancelButton: true,
        confirmButtonColor: '#8b5cf6',
        heightAuto: false
    }).then(res => {
        if(res.isConfirmed && res.value) {
            let groups = JSON.parse(localStorage.getItem(`nexium_groups_${window.currentUser?.username}`) || '["Default"]');
            if(!groups.includes(res.value)) {
                groups.push(res.value);
                localStorage.setItem(`nexium_groups_${window.currentUser?.username}`, JSON.stringify(groups));
                renderGroupsList();
            }
        }
    });
}
window.deleteGroup = function(g) {
    let groups = JSON.parse(localStorage.getItem(`nexium_groups_${window.currentUser?.username}`) || '["Default"]');
    groups = groups.filter(x => x !== g);
    localStorage.setItem(`nexium_groups_${window.currentUser?.username}`, JSON.stringify(groups));
    renderGroupsList();
}

window.moveProfileToGroup = async function(profileId) {
    let groups = JSON.parse(localStorage.getItem(`nexium_groups_${window.currentUser?.username}`) || '["Default"]');
    if (!groups.includes("Default")) { groups.unshift("Default"); }
    let optionsHtml = groups.map(g => `<option value="${g}">${g}</option>`).join('');
    
    const res = await Swal.fire({
        title: 'Move to Group',
        html: `<select id="swal-group-select" class="form-control" style="background:#0D111A; color:#fff; border:1px solid rgba(255,255,255,0.1); padding:10px; border-radius:8px;">${optionsHtml}</select>`,
        showCancelButton: true,
        confirmButtonText: 'Mover',
        confirmButtonColor: '#8b5cf6',
        heightAuto: false,
        preConfirm: () => {
            return document.getElementById('swal-group-select').value;
        }
    });
    
    if(res.isConfirmed && res.value) {
        const targetProf = allLoadedProfiles.find(p => p.id === profileId);
        if(targetProf) {
            targetProf.group = res.value;
            // Guardar enviando via IPC
            await require('electron').ipcRenderer.invoke('save-profile', targetProf);
            loadProfiles(); // Refresh
        }
    }
}

// Interceptamos rawInvoke para inyectar Owner (multi-tenant) y Group de forma transversal.
const electron = require('electron');
const rawInvoke = electron.ipcRenderer.invoke.bind(electron.ipcRenderer);
electron.ipcRenderer.invoke = async function(channel, ...args) {
    if (channel === 'save-profile') {
        const profileData = args[0];
        // Inyectamos validaciones invisibles
        profileData.owner = window.currentUser ? window.currentUser.username : 'unknown';
        if (!profileData.group) {
            const grpEl = document.getElementById('profileGroup');
            profileData.group = grpEl ? grpEl.value : 'Default';
        }
    }
    return rawInvoke(channel, ...args);
};



window.editGroup = function(oldName) {
    if (oldName === 'Default') return;
    Swal.fire({
        title: 'Edit Group',
        input: 'text',
        inputValue: oldName,
        background: '#14151a',
        color: '#fff',
        inputPlaceholder: 'New group name...',
        showCancelButton: true,
        confirmButtonText: 'Save',
        confirmButtonColor: '#8b5cf6',
        preConfirm: (name) => {
            if (!name || name.trim() === '') {
                Swal.showValidationMessage('Name cannot be empty');
            }
            return name.trim();
        }
    }).then(async (res) => {
        if (res.isConfirmed) {
            const newName = res.value;
            let groups = JSON.parse(localStorage.getItem(`nexium_groups_${window.currentUser?.username}`) || '["Default"]');
            if (groups.includes(newName) && newName !== oldName) {
                Swal.fire({icon: 'error', title: 'Group already exists', background: '#14151a', color: '#fff'});
                return;
            }
            if (newName === oldName) return;
            
            // Rename in groups list
            groups = groups.map(g => g === oldName ? newName : g);
            localStorage.setItem(`nexium_groups_${window.currentUser?.username}`, JSON.stringify(groups));
            
            // Rename in allLoadedProfiles
            let updated = 0;
            if(window.allLoadedProfiles) {
                for (let p of window.allLoadedProfiles) {
                    if (p.group === oldName) {
                        p.group = newName;
                        if(typeof window._saveProfile === 'function') {
                            await window._saveProfile(p);
                        }
                        updated++;
                    }
                }
            }
            
            renderGroupsList();
            if(typeof window.renderProfilesList === 'function' && updated > 0) window.renderProfilesList(window.allLoadedProfiles);
        }
    });
};
