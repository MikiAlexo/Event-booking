/**
 * dashboard.js - Modern Sidebar + Main Content User Dashboard
 * Handles events management, bookings, saved events, and attendee check-ins.
 */

(function () {
    'use strict';

    const API_AUTH     = 'api/auth.php';
    const API_EVENTS   = 'api/events.php';
    const API_BOOKINGS = 'api/bookings.php';

    // ─── DOM: Layout Elements ────────────────────────────────
    const sidebar          = document.getElementById('sidebar');
    const sidebarOverlay   = document.getElementById('sidebar-overlay');
    const menuToggle       = document.getElementById('menu-toggle');
    const tabs             = document.querySelectorAll('.tab');
    const tabPanels        = document.querySelectorAll('.tab-panel');

    // ─── DOM: Header Elements ────────────────────────────────
    const navUserName      = document.getElementById('nav-user-name');
    const navBalance       = document.getElementById('nav-balance');
    const navLogout        = document.getElementById('nav-logout');

    // ─── DOM: My Events Panel ───────────────────────────────
    const myEventsList     = document.getElementById('my-events-list');
    const myEventsEmpty    = document.getElementById('my-events-empty');
    const btnNewEvent      = document.getElementById('btn-new-event');

    // ─── DOM: Create Event Form & Upload Zone ────────────────
    const eventForm        = document.getElementById('event-form');
    const eventFormTitle   = document.getElementById('event-form-title');
    const eventFormId      = document.getElementById('event-form-id');
    const eventFormName    = document.getElementById('event-form-name');
    const eventFormType    = document.getElementById('event-form-type');
    const eventFormDate    = document.getElementById('event-form-date');
    const eventFormEndDate = document.getElementById('event-form-end-date');
    const eventFormSeats   = document.getElementById('event-form-seats');
    const eventFormLocation = document.getElementById('event-form-location');
    const eventFormPrice   = document.getElementById('event-form-price');
    const eventFormDesc    = document.getElementById('event-form-desc');
    const eventFormError   = document.getElementById('event-form-error');
    const eventFormSuccess = document.getElementById('event-form-success');
    const eventFormSubmit  = document.getElementById('event-form-submit');
    
    const uploadZone       = document.getElementById('upload-zone');
    const eventImage       = document.getElementById('eventImage');
    const uploadZonePrompt = document.getElementById('upload-zone-prompt');
    const btnRemovePoster  = document.getElementById('btn-remove-poster');
    const eventFormImagePreviewContainer = document.getElementById('event-form-image-preview-container');
    const eventFormImagePreview = document.getElementById('event-form-image-preview');
    const eventFormCancel  = document.getElementById('event-form-cancel');

    // ─── DOM: My Bookings Panel ──────────────────────────────
    const myBookingsList   = document.getElementById('my-bookings-list');
    const myBookingsEmpty  = document.getElementById('my-bookings-empty');

    // ─── DOM: Saved Events Panel ─────────────────────────────
    const savedEventsList  = document.getElementById('saved-events-list');
    const savedEventsEmpty = document.getElementById('saved-events-empty');

    // ─── DOM: Confirm Modal ──────────────────────────────────
    const confirmModal     = document.getElementById('confirm-modal');
    const confirmBackdrop  = document.getElementById('confirm-backdrop');
    const confirmTitle     = document.getElementById('confirm-title');
    const confirmMessage   = document.getElementById('confirm-message');
    const confirmYes       = document.getElementById('confirm-yes');
    const confirmNo        = document.getElementById('confirm-no');

    // ─── State Variables ─────────────────────────────────────
    let currentUser = null;
    let confirmCallback = null;
    let currentAttendees = [];
    let selectedEventId = null;

    // ═════════════════════════════════════════════════════════
    //  INITIALIZATION
    // ═════════════════════════════════════════════════════════
    async function init() {
        const authed = await checkAuth();
        if (!authed) {
            window.location.href = 'auth.html';
            return;
        }
        setupNavigation();
        setupUploadZone();
        setupAttendeeSearch();
        loadMyEvents();
        loadMyBookings();
        loadSavedEvents();
    }

    // ─── Auth Verification ──────────────────────────────────
    async function checkAuth() {
        try {
            const res  = await fetch(`${API_AUTH}?action=check`);
            const data = await res.json();
            if (data.logged_in) {
                currentUser = data.user;
                if (navUserName) navUserName.textContent = `Welcome back, ${currentUser.full_name}!`;
                updateBalance(currentUser.balance);
                return true;
            }
        } catch (e) { console.error('Auth verification error:', e); }
        return false;
    }

    function updateBalance(newBalance) {
        if (navBalance && newBalance !== undefined) {
            navBalance.innerHTML = `<span>${Number(newBalance).toFixed(2)} Birr</span>`;
        }
    }

    // ─── Logout ─────────────────────────────────────────────
    if (navLogout) {
        navLogout.addEventListener('click', async () => {
            await fetch(`${API_AUTH}?action=logout`);
            localStorage.removeItem('user');
            window.location.href = 'auth.html';
        });
    }

    // ═════════════════════════════════════════════════════════
    //  NAVIGATION & TABS
    // ═════════════════════════════════════════════════════════
    function setupNavigation() {
        // Tab switching
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const target = tab.dataset.tab;
                switchTab(target);
                
                // Close sidebar on mobile
                if (sidebar) sidebar.classList.remove('active');
                if (sidebarOverlay) sidebarOverlay.classList.remove('active');
            });
        });

        // Hamburger mobile toggle
        if (menuToggle && sidebar && sidebarOverlay) {
            menuToggle.addEventListener('click', () => {
                sidebar.classList.toggle('active');
                sidebarOverlay.classList.toggle('active');
            });

            sidebarOverlay.addEventListener('click', () => {
                sidebar.classList.remove('active');
                sidebarOverlay.classList.remove('active');
            });
        }

        // Inline tab redirects (e.g. from help guides)
        document.querySelectorAll('[data-go-tab]').forEach(el => {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                switchTab(el.dataset.goTab);
            });
        });
    }

    function switchTab(tabName) {
        tabs.forEach(t => {
            if (t.dataset.tab === tabName) {
                t.classList.add('active');
            } else {
                t.classList.remove('active');
            }
        });

        tabPanels.forEach(panel => {
            if (panel.id === 'tab-' + tabName) {
                panel.classList.remove('hidden');
                panel.classList.add('active');
            } else {
                panel.classList.add('hidden');
                panel.classList.remove('active');
            }
        });

        // Scroll main content to top
        const mainContent = document.querySelector('.main-content');
        if (mainContent) mainContent.scrollTop = 0;
    }

    // ═════════════════════════════════════════════════════════
    //  MY EVENTS PANEL
    // ═════════════════════════════════════════════════════════
    async function loadMyEvents() {
        if (!myEventsList) return;
        myEventsList.innerHTML = '';
        myEventsEmpty.classList.add('hidden');

        try {
            const res = await fetch(`${API_EVENTS}?creator_id=${currentUser.id}`);
            const events = await res.json();

            // Calculate Overview metrics
            const totalEvents = events.length;
            let totalTicketsSold = 0;
            let totalCapacity = 0;
            let totalRevenue = 0;

            events.forEach(ev => {
                const booked = ev.total_seats - ev.available_seats;
                totalTicketsSold += booked;
                totalCapacity += ev.total_seats;
                totalRevenue += booked * Number(ev.ticket_price);
            });

            // Update stats indicators
            const statsEventsCount = document.getElementById('stats-events-count');
            const statsTicketsSold = document.getElementById('stats-tickets-sold');
            const statsRevenue = document.getElementById('stats-revenue');

            if (statsEventsCount) statsEventsCount.textContent = totalEvents;
            if (statsTicketsSold) statsTicketsSold.textContent = totalTicketsSold;
            if (statsRevenue) statsRevenue.textContent = `${totalRevenue.toFixed(2)} Birr`;

            if (!events.length) {
                myEventsEmpty.classList.remove('hidden');
                return;
            }

            events.forEach(ev => myEventsList.appendChild(createMyEventRow(ev)));
        } catch (e) {
            console.error('Error loading events list:', e);
            myEventsEmpty.classList.remove('hidden');
        }
    }

    function createMyEventRow(ev) {
        const card = document.createElement('div');
        card.className = 'my-event-card';

        const dateObj = parseSQLDate(ev.event_date);
        const dateStr = dateObj.toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric'
        });
        const timeStr = dateObj.toLocaleTimeString('en-US', {
            hour: 'numeric', minute: '2-digit', hour12: true
        });

        const booked = ev.total_seats - ev.available_seats;
        const pct = ev.total_seats > 0 ? Math.round((booked / ev.total_seats) * 100) : 0;
        const earnings = booked * Number(ev.ticket_price);

        card.innerHTML = `
            <div class="my-event-card__thumbnail">
                ${ev.image_path 
                    ? `<img src="${escapeHtml(ev.image_path)}" alt="${escapeHtml(ev.title)}">` 
                    : `<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`}
            </div>
            <div class="my-event-card__info">
                <h3 class="my-event-card__title" title="${escapeHtml(ev.title)}">${escapeHtml(ev.title)}</h3>
                <div class="my-event-card__meta">
                    <span class="badge badge--${ev.event_type.toLowerCase()}">${escapeHtml(ev.event_type)}</span>
                    <span class="my-event-card__meta-item">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                        <span>${dateStr} at ${timeStr}</span>
                    </span>
                    <span class="my-event-card__meta-item">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                        <span>${escapeHtml(ev.location || 'Online')}</span>
                    </span>
                </div>
            </div>
            <div class="my-event-card__progress">
                <div class="my-event-card__progress-label">
                    <span>Booked</span>
                    <span>${pct}% (${booked}/${ev.total_seats})</span>
                </div>
                <div class="my-event-card__progress-bar">
                    <div class="my-event-card__progress-fill ${pct >= 100 ? 'full' : ''}" style="width: ${pct}%"></div>
                </div>
            </div>
            <div class="my-event-card__earnings">
                <span class="my-event-card__earnings-label">Revenue</span>
                <span class="my-event-card__earnings-value">${earnings.toFixed(2)} Birr</span>
            </div>
            <div class="my-event-card__actions">
                <button class="btn btn--sm btn--primary manage-btn"><span>Manage &amp; Check-in</span></button>
            </div>
        `;

        card.querySelector('.manage-btn').addEventListener('click', () => showCheckInView(ev));

        return card;
    }

    if (btnNewEvent) {
        btnNewEvent.addEventListener('click', () => {
            clearForm();
            eventFormTitle.textContent = 'Create New Event';
            eventFormSubmit.textContent = 'Create Event';
            eventFormSubmit.dataset.label = 'Create Event';
            switchTab('create-event');
        });
    }

    // ═════════════════════════════════════════════════════════
    //  CREATE EVENT FORM & POSTER UPLOAD ZONE
    // ═════════════════════════════════════════════════════════
    function setupUploadZone() {
        if (!uploadZone || !eventImage) return;

        // Click to choose
        uploadZone.addEventListener('click', (e) => {
            if (e.target.closest('#btn-remove-poster')) return;
            eventImage.click();
        });

        // Drag & Drop
        uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadZone.classList.add('dragover');
        });

        uploadZone.addEventListener('dragleave', () => {
            uploadZone.classList.remove('dragover');
        });

        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) {
                eventImage.files = e.dataTransfer.files;
                handlePosterFileSelected(eventImage.files[0]);
            }
        });

        // Input change
        eventImage.addEventListener('change', () => {
            if (eventImage.files.length > 0) {
                handlePosterFileSelected(eventImage.files[0]);
            }
        });

        // Remove poster
        if (btnRemovePoster) {
            btnRemovePoster.addEventListener('click', (e) => {
                e.stopPropagation();
                clearUploadPreview();
            });
        }

        // Cancel Form Action
        if (eventFormCancel) {
            eventFormCancel.addEventListener('click', () => {
                clearForm();
                switchTab('my-events');
            });
        }
    }

    function handlePosterFileSelected(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            if (eventFormImagePreview && eventFormImagePreviewContainer && uploadZonePrompt) {
                eventFormImagePreview.src = e.target.result;
                eventFormImagePreviewContainer.style.display = 'block';
                uploadZonePrompt.style.display = 'none';
            }
        };
        reader.readAsDataURL(file);
    }

    function clearUploadPreview() {
        if (eventImage) eventImage.value = '';
        if (eventFormImagePreview) eventFormImagePreview.src = '';
        if (eventFormImagePreviewContainer) eventFormImagePreviewContainer.style.display = 'none';
        if (uploadZonePrompt) uploadZonePrompt.style.display = 'flex';
    }

    function clearForm() {
        if (eventFormId) eventFormId.value = '';
        if (eventFormName) eventFormName.value = '';
        if (eventFormType) {
            eventFormType.value = '';
            eventFormType.dispatchEvent(new Event('change'));
        }
        if (eventFormDate) eventFormDate.value = '';
        if (eventFormEndDate) eventFormEndDate.value = '';
        if (eventFormSeats) eventFormSeats.value = '';
        if (eventFormLocation) eventFormLocation.value = '';
        if (eventFormPrice) eventFormPrice.value = '';
        if (eventFormDesc) eventFormDesc.value = '';
        clearUploadPreview();
        clearFormMessages();
    }

    function clearFormMessages() {
        if (eventFormError) {
            eventFormError.style.display = 'none';
            eventFormError.textContent = '';
        }
        if (eventFormSuccess) {
            eventFormSuccess.style.display = 'none';
            eventFormSuccess.textContent = '';
        }
    }

    // Submit Action (Create / Update)
    if (eventForm) {
        eventForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearFormMessages();

            const isEdit = eventFormId.value !== '';
            
            const title        = eventFormName.value.trim();
            const event_type   = eventFormType.value;
            const event_date   = eventFormDate.value;
            const end_time     = eventFormEndDate.value;
            const location     = eventFormLocation.value.trim() || 'Online';
            const ticket_price = parseFloat(eventFormPrice.value) || 0;
            const total_seats  = parseInt(eventFormSeats.value, 10);
            const description  = eventFormDesc.value.trim();

            if (!title || !event_type || !event_date || !end_time || total_seats < 1) {
                showFormError('Please fill in all required fields.');
                return;
            }

            if (new Date(end_time) <= new Date(event_date)) {
                showFormError('End time must be after the start time.');
                return;
            }

            const formData = new FormData();
            formData.append('title', title);
            formData.append('event_type', event_type);
            formData.append('event_date', event_date);
            formData.append('end_time', end_time);
            formData.append('location', location);
            formData.append('ticket_price', ticket_price);
            formData.append('total_seats', total_seats);
            formData.append('description', description);

            if (isEdit) {
                formData.append('id', parseInt(eventFormId.value, 10));
                formData.append('_method', 'PUT');
            }

            if (eventImage && eventImage.files.length > 0) {
                formData.append('event_image', eventImage.files[0]);
            }

            eventFormSubmit.disabled = true;
            eventFormSubmit.textContent = 'Saving…';

            try {
                const res = await fetch(API_EVENTS, {
                    method: 'POST',
                    body: formData,
                });

                const data = await res.json();

                if (!res.ok) {
                    showFormError(data.error || 'Failed to save event.');
                    return;
                }

                showFormSuccess(isEdit ? 'Event updated successfully!' : 'Event created successfully!');
                setTimeout(() => {
                    clearForm();
                    switchTab('my-events');
                    loadMyEvents();
                }, 1000);

            } catch (err) {
                showFormError('Network error. Please try again.');
            } finally {
                eventFormSubmit.disabled = false;
                eventFormSubmit.textContent = eventFormSubmit.dataset.label;
            }
        });
    }

    function showFormError(msg) {
        if (eventFormError) {
            eventFormError.textContent = msg;
            eventFormError.style.display = 'block';
        }
    }

    function showFormSuccess(msg) {
        if (eventFormSuccess) {
            eventFormSuccess.textContent = msg;
            eventFormSuccess.style.display = 'block';
        }
    }

    // ─── Edit Event Action Redirect ──────────────────────────
    function openEditEvent(ev) {
        clearForm();
        eventFormTitle.textContent = 'Edit Event';
        eventFormSubmit.textContent = 'Update Event';
        eventFormSubmit.dataset.label = 'Update Event';
        
        eventFormId.value       = ev.id;
        eventFormName.value     = ev.title;
        eventFormType.value     = ev.event_type;
        eventFormType.dispatchEvent(new Event('change'));
        eventFormSeats.value    = ev.total_seats;
        eventFormLocation.value = ev.location || '';
        eventFormPrice.value    = ev.ticket_price || 0;
        eventFormDesc.value     = ev.description || '';

        const dt = parseSQLDate(ev.event_date);
        const y  = dt.getFullYear();
        const m  = String(dt.getMonth() + 1).padStart(2, '0');
        const d  = String(dt.getDate()).padStart(2, '0');
        const h  = String(dt.getHours()).padStart(2, '0');
        const mi = String(dt.getMinutes()).padStart(2, '0');
        eventFormDate.value = `${y}-${m}-${d}T${h}:${mi}`;

        if (ev.end_time) {
            const edt = parseSQLDate(ev.end_time);
            const ey  = edt.getFullYear();
            const em  = String(edt.getMonth() + 1).padStart(2, '0');
            const ed  = String(edt.getDate()).padStart(2, '0');
            const eh  = String(edt.getHours()).padStart(2, '0');
            const emi = String(edt.getMinutes()).padStart(2, '0');
            eventFormEndDate.value = `${ey}-${em}-${ed}T${eh}:${emi}`;
        } else {
            eventFormEndDate.value = '';
        }

        if (ev.image_path) {
            if (eventFormImagePreview && eventFormImagePreviewContainer && uploadZonePrompt) {
                eventFormImagePreview.src = ev.image_path;
                eventFormImagePreviewContainer.style.display = 'block';
                uploadZonePrompt.style.display = 'none';
            }
        }

        switchTab('create-event');
    }

    // ─── Delete Event Action ─────────────────────────────────
    async function deleteEvent(eventId) {
        try {
            const res = await fetch(`${API_EVENTS}?id=${eventId}`, { method: 'DELETE' });
            const data = await res.json();

            if (!res.ok) {
                alert(data.error || 'Failed to delete event.');
                return;
            }

            loadMyEvents();
            loadMyBookings();
            loadSavedEvents();
        } catch (err) {
            alert('Network error. Please try again.');
        }
    }

    // ═════════════════════════════════════════════════════════
    //  CHECK-IN MANAGER
    // ═════════════════════════════════════════════════════════
    async function showCheckInView(ev) {
        selectedEventId = ev.id;
        switchTab('check-in');

        const noEventSummary = document.getElementById('check-in-no-event-summary');
        const eventSummary   = document.getElementById('check-in-event-summary');

        if (noEventSummary) noEventSummary.classList.add('hidden');
        if (eventSummary) eventSummary.classList.remove('hidden');

        // Populate Left Column details
        const posterEl   = document.getElementById('check-in-event-poster');
        const titleEl    = document.getElementById('check-in-event-title');
        const typeEl     = document.getElementById('check-in-event-type');
        const dateEl     = document.getElementById('check-in-event-date');
        const locationEl = document.getElementById('check-in-event-location');
        const capacityEl = document.getElementById('check-in-event-capacity');

        const dateObj = parseSQLDate(ev.event_date);
        const dateStr = dateObj.toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric'
        });
        const timeStr = dateObj.toLocaleTimeString('en-US', {
            hour: 'numeric', minute: '2-digit', hour12: true
        });

        const booked = ev.total_seats - ev.available_seats;

        if (posterEl) {
            if (ev.image_path) {
                posterEl.src = ev.image_path;
                posterEl.parentElement.style.display = 'block';
            } else {
                posterEl.src = '';
                posterEl.parentElement.style.display = 'none';
            }
        }
        if (titleEl) titleEl.textContent = ev.title;
        if (typeEl) {
            typeEl.textContent = ev.event_type;
            typeEl.className = `badge badge--${ev.event_type.toLowerCase()}`;
        }
        if (dateEl) dateEl.textContent = `${dateStr} at ${timeStr}`;
        if (locationEl) locationEl.textContent = ev.location || 'Online';
        if (capacityEl) capacityEl.textContent = `${booked} / ${ev.total_seats} booked`;

        // Re-bind Action Buttons
        const btnEdit   = document.getElementById('check-in-event-edit');
        const btnDelete = document.getElementById('check-in-event-delete');

        if (btnEdit) {
            const newEdit = btnEdit.cloneNode(true);
            btnEdit.parentNode.replaceChild(newEdit, btnEdit);
            newEdit.addEventListener('click', () => openEditEvent(ev));
        }

        if (btnDelete) {
            const newDelete = btnDelete.cloneNode(true);
            btnDelete.parentNode.replaceChild(newDelete, btnDelete);
            newDelete.addEventListener('click', () => {
                showConfirm(
                    'Delete Event',
                    `Are you sure you want to delete "${escapeHtml(ev.title)}"? This will release all bookings.`,
                    async () => {
                        await deleteEvent(ev.id);
                        if (noEventSummary) noEventSummary.classList.remove('hidden');
                        if (eventSummary) eventSummary.classList.add('hidden');
                        const listContainer = document.getElementById('check-in-attendees-list');
                        if (listContainer) listContainer.innerHTML = '<p class="select-hint">Please select an event from "My Events" to view attendees.</p>';
                        switchTab('my-events');
                    }
                );
            });
        }

        // Clear search box value when loading new event
        const attendeeSearch = document.getElementById('attendee-search');
        if (attendeeSearch) attendeeSearch.value = '';

        // Load attendees
        await loadCheckInAttendees(ev.id);
    }

    async function loadCheckInAttendees(eventId) {
        const listContainer = document.getElementById('check-in-attendees-list');
        const emptyState = document.getElementById('check-in-attendees-empty');

        if (listContainer) {
            listContainer.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
        }
        if (emptyState) emptyState.classList.add('hidden');

        try {
            const res = await fetch(`${API_BOOKINGS}?action=attendees&event_id=${eventId}`);
            currentAttendees = await res.json();
            renderAttendeeCheckInList(currentAttendees);
        } catch (e) {
            console.error('Error loading attendees:', e);
            if (listContainer) {
                listContainer.innerHTML = '<p class="auth-error">Failed to load attendees list.</p>';
            }
        }
    }

    function renderAttendeeCheckInList(attendees) {
        const listContainer = document.getElementById('check-in-attendees-list');
        const emptyState = document.getElementById('check-in-attendees-empty');

        if (!listContainer) return;
        listContainer.innerHTML = '';

        if (!attendees.length) {
            if (emptyState) emptyState.classList.remove('hidden');
            return;
        }

        if (emptyState) emptyState.classList.add('hidden');

        attendees.forEach(a => {
            const row = document.createElement('div');
            row.className = 'attendee-row';
            const isCheckedIn = parseInt(a.checked_in) === 1;

            row.innerHTML = `
                <div class="attendee-row__info">
                    <div class="attendee-row__name">${escapeHtml(a.full_name)}</div>
                    <div class="attendee-row__email">${escapeHtml(a.email)}</div>
                </div>
                <div class="attendee-row__actions">
                    <span class="badge-status badge-status--${isCheckedIn ? 'checked-in' : 'pending'}">
                        ${isCheckedIn ? 'Checked In' : 'Pending'}
                    </span>
                    ${!isCheckedIn ? `<button class="btn btn--sm btn--outline check-in-btn" data-id="${a.booking_id}"><span>Check In</span></button>` : ''}
                </div>
            `;

            if (!isCheckedIn) {
                row.querySelector('.check-in-btn').addEventListener('click', async (e) => {
                    const btn = e.currentTarget;
                    btn.disabled = true;
                    btn.querySelector('span').textContent = 'Updating...';

                    try {
                        const res = await fetch(`${API_BOOKINGS}?action=check_in`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ booking_id: a.booking_id, checked_in: true })
                        });
                        const data = await res.json();
                        if (data.success) {
                            a.checked_in = 1;
                            // Re-filter with the current input value if any
                            const query = document.getElementById('attendee-search').value.trim().toLowerCase();
                            if (query) {
                                filterAttendees(query);
                            } else {
                                renderAttendeeCheckInList(currentAttendees);
                            }
                        } else {
                            alert('Check-in failed.');
                            btn.disabled = false;
                            btn.querySelector('span').textContent = 'Check In';
                        }
                    } catch (err) {
                        alert('Network error.');
                        btn.disabled = false;
                        btn.querySelector('span').textContent = 'Check In';
                    }
                });
            }

            listContainer.appendChild(row);
        });
    }

    function setupAttendeeSearch() {
        const attendeeSearch = document.getElementById('attendee-search');
        if (attendeeSearch) {
            attendeeSearch.addEventListener('input', function() {
                filterAttendees(this.value.trim().toLowerCase());
            });
        }
    }

    function filterAttendees(query) {
        const filtered = currentAttendees.filter(a => 
            a.full_name.toLowerCase().includes(query) || 
            a.email.toLowerCase().includes(query)
        );
        renderAttendeeCheckInList(filtered);
    }

    // ═════════════════════════════════════════════════════════
    //  MY BOOKINGS PANEL
    // ═════════════════════════════════════════════════════════
    async function loadMyBookings() {
        if (!myBookingsList) return;
        myBookingsList.innerHTML = '';
        myBookingsEmpty.classList.add('hidden');

        try {
            const res      = await fetch(`${API_BOOKINGS}?action=list`);
            const data     = await res.json();
            const bookings = data.bookings || [];
            const waitlists = data.waitlists || [];

            if (!bookings.length && !waitlists.length) {
                myBookingsEmpty.classList.remove('hidden');
                return;
            }

            bookings.forEach(b => myBookingsList.appendChild(createBookingRow(b, false)));
            waitlists.forEach(w => myBookingsList.appendChild(createBookingRow(w, true)));
        } catch (e) {
            console.error('Error loading bookings:', e);
            myBookingsEmpty.classList.remove('hidden');
        }
    }

    function createBookingRow(b, isWaitlist) {
        const row = document.createElement('div');
        row.className = 'booking-row';

        const dateObj   = parseSQLDate(b.event_date);
        const dateStr   = dateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        const timeStr   = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        
        let bookedOnStr = '';
        let statusBadge = '';
        let isCancelled = false;
        
        if (isWaitlist) {
            bookedOnStr = `Joined waitlist on ${parseSQLDate(b.joined_at).toLocaleDateString()}`;
            statusBadge = `<span class="badge" style="background:#f39c12; color:#fff;">Waitlist</span>`;
        } else {
            bookedOnStr = `Booked on ${parseSQLDate(b.booking_date).toLocaleDateString()}`;
            isCancelled = b.status === 'cancelled';
            statusBadge = `<span class="booking-status booking-status--${b.status}">${b.status === 'active' ? 'Active' : 'Cancelled'}</span>`;
        }

        row.innerHTML = `
            <div class="booking-row__info">
                <h3 class="booking-row__title ${isCancelled ? 'cancelled-text' : ''}">${escapeHtml(b.title)}</h3>
                <p class="booking-row__meta">
                    <span class="badge badge--${b.event_type.toLowerCase()}">${escapeHtml(b.event_type)}</span>
                    <span>${dateStr} at ${timeStr}</span>
                    <span>${bookedOnStr}</span>
                </p>
            </div>
            <div class="booking-row__actions">
                ${statusBadge}
                ${!isCancelled && !isWaitlist ? `<button class="btn btn--sm btn--outline btn--danger-outline cancel-booking-btn" data-id="${b.booking_id}"><span>Cancel</span></button>` : ''}
            </div>
        `;

        if (!isCancelled && !isWaitlist) {
            row.querySelector('.cancel-booking-btn').addEventListener('click', () => {
                showConfirm(
                    'Cancel Booking',
                    `Cancel booking for "${escapeHtml(b.title)}"? Refund will be credited in Birr and your seat will be released.`,
                    () => cancelBooking(b.booking_id)
                );
            });
        }

        return row;
    }

    async function cancelBooking(bookingId) {
        try {
            const res = await fetch(`${API_BOOKINGS}?action=cancel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ booking_id: bookingId }),
            });

            const data = await res.json();

            if (!res.ok) {
                alert(data.error || 'Cancellation failed.');
                return;
            }
            
            if (data.new_balance !== undefined) {
                updateBalance(data.new_balance);
            }

            loadMyBookings();
            loadMyEvents();
        } catch (err) {
            alert('Network error. Please try again.');
        }
    }

    // ═════════════════════════════════════════════════════════
    //  SAVED EVENTS PANEL
    // ═════════════════════════════════════════════════════════
    async function loadSavedEvents() {
        if (!savedEventsList) return;
        savedEventsList.innerHTML = '';
        savedEventsEmpty.classList.add('hidden');

        try {
            const res = await fetch(`${API_EVENTS}?action=saved`);
            const events = await res.json();

            if (!events.length) {
                savedEventsEmpty.classList.remove('hidden');
                return;
            }

            events.forEach(ev => {
                savedEventsList.appendChild(createSavedEventCard(ev));
            });
        } catch (e) {
            console.error('Error loading saved events:', e);
            savedEventsEmpty.classList.remove('hidden');
        }
    }

    function createSavedEventCard(ev) {
        const card = document.createElement('div');
        card.className = 'event-card';
        card.dataset.id = ev.id;

        const dateObj = parseSQLDate(ev.event_date);
        const month   = dateObj.toLocaleString('en-US', { month: 'short' }).toUpperCase();
        const day     = dateObj.getDate();

        const price = Number(ev.ticket_price) > 0 ? `${Math.round(ev.ticket_price)} Birr` : 'FREE';

        card.innerHTML = `
            <div class="event-card__image-section">
                ${ev.image_path 
                    ? `<img src="${escapeHtml(ev.image_path)}" alt="${escapeHtml(ev.title)}" class="event-card__img">`
                    : `<div class="event-card__img-fallback">
                         <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                       </div>`
                }
                <div class="event-card__overlay-top-left">
                    <span class="category-pill">${escapeHtml(ev.event_type)}</span>
                </div>
                <button class="event-card__heart-btn saved" title="Unsave Event">
                    <svg class="heart-icon" viewBox="0 0 24 24" fill="#D4AF37" stroke="#D4AF37" stroke-width="2">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                    </svg>
                </button>
                <div class="event-card__overlay-bottom">
                    <span class="info-badge">
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                        <span>${month} ${day}</span>
                    </span>
                    <span class="info-badge">
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                        <span>${escapeHtml(ev.location || 'Online')}</span>
                    </span>
                </div>
            </div>
            <div class="event-card__body-section">
                <h3 class="event-card__title" title="${escapeHtml(ev.title)}">${escapeHtml(ev.title)}</h3>
                <div class="event-card__footer-section">
                    <div class="event-card__price-box">
                        <span class="price-from-label">Price</span>
                        <span class="price-amount">${price}</span>
                    </div>
                    <button class="event-card__ticket-btn">${ev.available_seats <= 0 ? 'Waitlist' : 'Get Ticket'}</button>
                </div>
            </div>
        `;

        const heartBtn = card.querySelector('.event-card__heart-btn');
        heartBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            try {
                const res = await fetch(`${API_EVENTS}?action=unsave`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ event_id: ev.id })
                });
                if (res.ok) {
                    card.classList.add('fade-out');
                    setTimeout(() => {
                        card.remove();
                        const remaining = savedEventsList.querySelectorAll('.event-card').length;
                        if (remaining === 0) {
                            savedEventsEmpty.classList.remove('hidden');
                        }
                    }, 300);
                }
            } catch (e) {}
        });

        // Ticket action (redirects to browse detail / handles booking flow)
        card.addEventListener('click', () => {
            window.location.href = `index.php?event_id=${ev.id}`;
        });

        return card;
    }

    // ═════════════════════════════════════════════════════════
    //  CONFIRM DIALOG MODAL
    // ═════════════════════════════════════════════════════════
    function showConfirm(title, message, onConfirm) {
        confirmTitle.textContent = title;
        confirmMessage.textContent = message;
        confirmCallback = onConfirm;
        confirmModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    function closeConfirm() {
        confirmModal.classList.add('hidden');
        document.body.style.overflow = '';
        confirmCallback = null;
    }

    if (confirmYes) {
        confirmYes.addEventListener('click', () => {
            if (confirmCallback) confirmCallback();
            closeConfirm();
        });
    }

    if (confirmNo) confirmNo.addEventListener('click', closeConfirm);
    if (confirmBackdrop) confirmBackdrop.addEventListener('click', closeConfirm);

    // ═════════════════════════════════════════════════════════
    //  HELPER UTILITIES
    // ═════════════════════════════════════════════════════════
    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function parseSQLDate(sqlDate) {
        if (!sqlDate) return new Date();
        const isoStr = sqlDate.replace(' ', 'T');
        const date = new Date(isoStr);
        return isNaN(date.getTime()) ? new Date(sqlDate) : date;
    }

    // ─── Boot App ───────────────────────────────────────────
    init();

    // Export function to navigate and load event management/check-in
    async function goToManageEvent(eventId) {
        try {
            const res = await fetch(`${API_EVENTS}?id=${eventId}`);
            if (!res.ok) throw new Error('Failed to fetch event details');
            const event = await res.json();
            showCheckInView(event);
        } catch (err) {
            console.error(err);
            alert('Error loading event for check-in: ' + err.message);
        }
    }
    window.goToManageEvent = goToManageEvent;

})();
