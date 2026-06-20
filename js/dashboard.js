/**
 * dashboard.js - User dashboard: manage events, view bookings, cancel tickets
 */

(function () {
    'use strict';

    const API_AUTH     = 'api/auth.php';
    const API_EVENTS   = 'api/events.php';
    const API_BOOKINGS = 'api/bookings.php';

    // ─── DOM: Nav ───────────────────────────────────────────
    const navUserName = document.getElementById('nav-user-name');
    const navLogout   = document.getElementById('nav-logout');
    const navBalance  = document.getElementById('nav-balance');

    // ─── DOM: Tabs ──────────────────────────────────────────
    const tabs       = document.querySelectorAll('.tab');
    const tabPanels  = document.querySelectorAll('.tab-panel');

    // ─── DOM: My Events ─────────────────────────────────────
    const myEventsList  = document.getElementById('my-events-list');
    const myEventsEmpty = document.getElementById('my-events-empty');
    const btnNewEvent   = document.getElementById('btn-new-event');

    // ─── DOM: My Bookings ───────────────────────────────────
    const myBookingsList  = document.getElementById('my-bookings-list');
    const myBookingsEmpty = document.getElementById('my-bookings-empty');

    // ─── DOM: Saved Events ──────────────────────────────────
    const savedEventsList  = document.getElementById('saved-events-list');
    const savedEventsEmpty = document.getElementById('saved-events-empty');

    // ─── DOM: Event Form Modal ──────────────────────────────
    const eventFormModal   = document.getElementById('event-form-modal');
    const eventFormBackdrop = document.getElementById('event-form-backdrop');
    const eventFormClose   = document.getElementById('event-form-close');
    const eventFormCancel  = document.getElementById('event-form-cancel');
    const eventFormTitle   = document.getElementById('event-form-title');
    const eventForm        = document.getElementById('event-form');
    const eventFormId      = document.getElementById('event-form-id');
    const eventFormName    = document.getElementById('event-form-name');
    const eventFormType    = document.getElementById('event-form-type');
    const eventFormDate    = document.getElementById('event-form-date');
    const eventFormSeats   = document.getElementById('event-form-seats');
    const eventFormLocation = document.getElementById('event-form-location');
    const eventFormPrice   = document.getElementById('event-form-price');
    const eventFormDesc    = document.getElementById('event-form-desc');
    const eventFormError   = document.getElementById('event-form-error');
    const eventFormSuccess = document.getElementById('event-form-success');
    const eventFormSubmit  = document.getElementById('event-form-submit');
    const eventFormImagePreviewContainer = document.getElementById('event-form-image-preview-container');
    const eventFormImagePreview = document.getElementById('event-form-image-preview');

    // ─── DOM: Attendees Modal ───────────────────────────────
    const attendeesModal    = document.getElementById('attendees-modal');
    const attendeesBackdrop = document.getElementById('attendees-backdrop');
    const attendeesClose    = document.getElementById('attendees-close');
    const attendeesList     = document.getElementById('attendees-list');
    const attendeesEmpty    = document.getElementById('attendees-empty');

    // ─── DOM: Confirm Modal ─────────────────────────────────
    const confirmModal    = document.getElementById('confirm-modal');
    const confirmBackdrop = document.getElementById('confirm-backdrop');
    const confirmTitle    = document.getElementById('confirm-title');
    const confirmMessage  = document.getElementById('confirm-message');
    const confirmYes      = document.getElementById('confirm-yes');
    const confirmNo       = document.getElementById('confirm-no');

    let currentUser = null;
    let confirmCallback = null;

    // ═════════════════════════════════════════════════════════
    //  INIT
    // ═════════════════════════════════════════════════════════
    async function init() {
        const authed = await checkAuth();
        if (!authed) {
            window.location.href = 'auth.html';
            return;
        }
        setupTabs();
        loadMyEvents();
        loadMyBookings();
        loadSavedEvents();
    }

    // ─── Auth Check ─────────────────────────────────────────
    async function checkAuth() {
        try {
            const res  = await fetch(`${API_AUTH}?action=check`);
            const data = await res.json();
            if (data.logged_in) {
                currentUser = data.user;
                navUserName.textContent = `Hi, ${currentUser.full_name}`;
                updateBalance(currentUser.balance);
                
                // Update profile card
                const profileWelcomeName = document.getElementById('dashboard-welcome-name');
                const profileWelcomeEmail = document.getElementById('dashboard-welcome-email');
                const dashboardProfile = document.getElementById('dashboard-profile');
                
                if (profileWelcomeName) profileWelcomeName.textContent = `Hi, ${currentUser.full_name}`;
                if (profileWelcomeEmail) profileWelcomeEmail.textContent = currentUser.email;
                if (dashboardProfile) dashboardProfile.classList.remove('hidden');

                return true;
            }
        } catch (e) { console.error('Auth check error:', e); }
        return false;
    }

    function updateBalance(newBalance) {
        if(navBalance && newBalance !== undefined) {
            navBalance.innerHTML = `<span>Balance: ${Number(newBalance).toFixed(2)} ETB</span>`;
        }
        const profileWelcomeBalance = document.getElementById('dashboard-welcome-balance');
        if (profileWelcomeBalance && newBalance !== undefined) {
            profileWelcomeBalance.textContent = `${Number(newBalance).toFixed(2)} ETB`;
        }
    }

    // ─── Logout ─────────────────────────────────────────────
    if(navLogout) {
        navLogout.addEventListener('click', async () => {
            await fetch(`${API_AUTH}?action=logout`);
            localStorage.removeItem('user');
            window.location.href = 'auth.html';
        });
    }

    // ─── Tabs ───────────────────────────────────────────────
    function setupTabs() {
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tabPanels.forEach(p => p.classList.add('hidden'));
                tab.classList.add('active');

                const target = tab.dataset.tab;
                document.getElementById('tab-' + target).classList.remove('hidden');
                document.getElementById('tab-' + target).classList.add('active');
            });
        });
    }

    // ═════════════════════════════════════════════════════════
    //  MY EVENTS
    // ═════════════════════════════════════════════════════════
    async function loadMyEvents() {
        myEventsList.innerHTML = '';
        myEventsEmpty.classList.add('hidden');

        try {
            const res    = await fetch(`${API_EVENTS}?creator_id=${currentUser.id}`);
            const events = await res.json();

            // Calculate Analytics
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

            const occupancyRate = totalCapacity > 0 ? Math.round((totalTicketsSold / totalCapacity) * 100) : 0;

            const statsEventsCount = document.getElementById('stats-events-count');
            const statsTicketsSold = document.getElementById('stats-tickets-sold');
            const statsRevenue = document.getElementById('stats-revenue');
            const statsOccupancy = document.getElementById('stats-occupancy');
            const hostAnalytics = document.getElementById('host-analytics');

            if (statsEventsCount) statsEventsCount.textContent = totalEvents;
            if (statsTicketsSold) statsTicketsSold.textContent = totalTicketsSold;
            if (statsRevenue) statsRevenue.textContent = `${totalRevenue.toFixed(2)} ETB`;
            if (statsOccupancy) statsOccupancy.textContent = `${occupancyRate}%`;

            if (hostAnalytics) {
                if (totalEvents > 0) {
                    hostAnalytics.classList.remove('hidden');
                } else {
                    hostAnalytics.classList.add('hidden');
                }
            }

            if (!events.length) {
                myEventsEmpty.classList.remove('hidden');
                return;
            }

            events.forEach(ev => myEventsList.appendChild(createMyEventRow(ev)));
        } catch (e) {
            console.error('Error loading my events:', e);
            myEventsEmpty.classList.remove('hidden');
        }
    }

    function createMyEventRow(ev) {
        const row = document.createElement('div');
        row.className = 'event-row';

        const dateObj = parseSQLDate(ev.event_date);
        const dateStr = dateObj.toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric'
        });
        const timeStr = dateObj.toLocaleTimeString('en-US', {
            hour: 'numeric', minute: '2-digit', hour12: true
        });

        const booked = ev.total_seats - ev.available_seats;

        row.innerHTML = `
            <div class="event-row__info">
                <h3 class="event-row__title">${escapeHtml(ev.title)}</h3>
                <p class="event-row__meta">
                    <span class="badge badge--${ev.event_type.toLowerCase()}">${escapeHtml(ev.event_type)}</span>
                    <span>${dateStr} at ${timeStr}</span>
                    <span>${booked} / ${ev.total_seats} booked</span>
                </p>
            </div>
            <div class="event-row__actions" style="display:flex; gap:0.5rem;">
                <button class="btn btn--sm btn--primary attendees-btn" data-id="${ev.id}"><span>Attendees</span></button>
                <button class="btn btn--sm btn--outline edit-event-btn" data-id="${ev.id}"><span>Edit</span></button>
                <button class="btn btn--sm btn--danger-outline delete-event-btn" data-id="${ev.id}"><span>Delete</span></button>
            </div>
        `;

        row.querySelector('.attendees-btn').addEventListener('click', () => loadAttendees(ev.id));
        row.querySelector('.edit-event-btn').addEventListener('click', () => openEditEvent(ev));
        row.querySelector('.delete-event-btn').addEventListener('click', () => {
            showConfirm(
                'Delete Event',
                `Are you sure you want to delete "${escapeHtml(ev.title)}"? All associated bookings will also be removed.`,
                () => deleteEvent(ev.id)
            );
        });

        return row;
    }

    // ── New Event ───────────────────────────────────────────
    if(btnNewEvent) {
        btnNewEvent.addEventListener('click', () => {
            eventFormTitle.textContent = 'Create New Event';
            eventFormSubmit.textContent = 'Create Event';
            eventFormSubmit.dataset.label = 'Create Event';
            eventFormId.value    = '';
            eventFormName.value  = '';
            eventFormType.value  = '';
            eventFormType.dispatchEvent(new Event('change'));
            eventFormDate.value  = '';
            eventFormSeats.value = '';
            eventFormLocation.value = '';
            eventFormPrice.value = '';
            eventFormDesc.value  = '';
            const imageInput = document.getElementById('eventImage');
            if (imageInput) imageInput.value = '';
            if (eventFormImagePreviewContainer) eventFormImagePreviewContainer.style.display = 'none';
            if (eventFormImagePreview) eventFormImagePreview.src = '';
            clearFormMessages();
            openEventFormModal();
        });
    }

    // ── Edit Event ──────────────────────────────────────────
    function openEditEvent(ev) {
        eventFormTitle.textContent = 'Edit Event';
        eventFormSubmit.textContent = 'Update Event';
        eventFormSubmit.dataset.label = 'Update Event';
        eventFormId.value    = ev.id;
        eventFormName.value  = ev.title;
        eventFormType.value  = ev.event_type;
        eventFormType.dispatchEvent(new Event('change'));
        eventFormSeats.value = ev.total_seats;
        eventFormLocation.value = ev.location || '';
        eventFormPrice.value = ev.ticket_price || 0;
        eventFormDesc.value  = ev.description || '';

        const dt = parseSQLDate(ev.event_date);
        const y  = dt.getFullYear();
        const m  = String(dt.getMonth() + 1).padStart(2, '0');
        const d  = String(dt.getDate()).padStart(2, '0');
        const h  = String(dt.getHours()).padStart(2, '0');
        const mi = String(dt.getMinutes()).padStart(2, '0');
        eventFormDate.value = `${y}-${m}-${d}T${h}:${mi}`;

        const imageInput = document.getElementById('eventImage');
        if (imageInput) imageInput.value = '';

        if (eventFormImagePreviewContainer && eventFormImagePreview) {
            if (ev.image_path) {
                eventFormImagePreview.src = ev.image_path;
                eventFormImagePreviewContainer.style.display = 'block';
            } else {
                eventFormImagePreviewContainer.style.display = 'none';
                eventFormImagePreview.src = '';
            }
        }

        clearFormMessages();
        openEventFormModal();
    }

    // ── Save Event (Create or Update) ───────────────────────
    if(eventForm) {
        eventForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearFormMessages();

            const isEdit = eventFormId.value !== '';
            
            const title = eventFormName.value.trim();
            const event_type = eventFormType.value;
            const event_date = eventFormDate.value;
            const location = eventFormLocation.value.trim() || 'Online';
            const ticket_price = parseFloat(eventFormPrice.value) || 0;
            const total_seats = parseInt(eventFormSeats.value, 10);
            const description = eventFormDesc.value.trim();

            if (!title || !event_type || !event_date || total_seats < 1) {
                showFormError('Please fill in all required fields.');
                return;
            }

            const formData = new FormData();
            formData.append('title', title);
            formData.append('event_type', event_type);
            formData.append('event_date', event_date);
            formData.append('location', location);
            formData.append('ticket_price', ticket_price);
            formData.append('total_seats', total_seats);
            formData.append('description', description);

            if (isEdit) {
                formData.append('id', parseInt(eventFormId.value, 10));
                formData.append('_method', 'PUT');
            }

            const imageInput = document.getElementById('eventImage');
            if (imageInput && imageInput.files.length > 0) {
                formData.append('event_image', imageInput.files[0]);
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
                    closeEventFormModal();
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

    // ── Delete Event ────────────────────────────────────────
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
    //  ATTENDEES (HOST TOOLS)
    // ═════════════════════════════════════════════════════════
    async function loadAttendees(eventId) {
        attendeesModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        attendeesList.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
        attendeesEmpty.classList.add('hidden');

        try {
            const res = await fetch(`${API_BOOKINGS}?action=attendees&event_id=${eventId}`);
            const attendees = await res.json();

            attendeesList.innerHTML = '';
            if (!attendees.length) {
                attendeesEmpty.classList.remove('hidden');
                return;
            }

            attendees.forEach(a => {
                const row = document.createElement('div');
                row.className = 'event-row';
                row.style.alignItems = 'center';
                const isCheckedIn = parseInt(a.checked_in) === 1;

                row.innerHTML = `
                    <div class="event-row__info">
                        <h4 style="margin:0;">${escapeHtml(a.full_name)}</h4>
                        <p style="margin:0; font-size:0.875rem; color:#aaa;">${escapeHtml(a.email)}</p>
                    </div>
                    <div class="event-row__actions">
                        <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer;">
                            <input type="checkbox" class="checkin-toggle" data-id="${a.booking_id}" ${isCheckedIn ? 'checked' : ''} style="width:1.25rem; height:1.25rem; accent-color:var(--color-primary);">
                            <span style="color:${isCheckedIn ? 'var(--color-primary)' : '#aaa'}">${isCheckedIn ? 'Checked In' : 'Check In'}</span>
                        </label>
                    </div>
                `;

                row.querySelector('.checkin-toggle').addEventListener('change', async (e) => {
                    const checked = e.target.checked;
                    const span = e.target.nextElementSibling;
                    try {
                        await fetch(`${API_BOOKINGS}?action=check_in`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ booking_id: a.booking_id, checked_in: checked })
                        });
                        span.textContent = checked ? 'Checked In' : 'Check In';
                        span.style.color = checked ? 'var(--color-primary)' : '#aaa';
                    } catch(err) {
                        e.target.checked = !checked;
                        alert('Failed to update status.');
                    }
                });

                attendeesList.appendChild(row);
            });
        } catch(e) {
            attendeesList.innerHTML = '<p class="auth-error">Failed to load attendees.</p>';
        }
    }

    if(attendeesClose) {
        attendeesClose.addEventListener('click', () => {
            attendeesModal.classList.add('hidden');
            document.body.style.overflow = '';
        });
    }
    if(attendeesBackdrop) {
        attendeesBackdrop.addEventListener('click', () => {
            attendeesModal.classList.add('hidden');
            document.body.style.overflow = '';
        });
    }

    // ═════════════════════════════════════════════════════════
    //  MY BOOKINGS & WAITLISTS
    // ═════════════════════════════════════════════════════════
    async function loadMyBookings() {
        myBookingsList.innerHTML = '';
        myBookingsEmpty.classList.add('hidden');

        try {
            const res      = await fetch(`${API_BOOKINGS}?action=list`);
            const data = await res.json();
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
                ${!isCancelled && !isWaitlist ? `<button class="btn btn--sm btn--danger-outline cancel-booking-btn" data-id="${b.booking_id}"><span>Cancel</span></button>` : ''}
            </div>
        `;

        if (!isCancelled && !isWaitlist) {
            row.querySelector('.cancel-booking-btn').addEventListener('click', () => {
                showConfirm(
                    'Cancel Booking',
                    `Cancel your booking for "${escapeHtml(b.title)}"? Your ETB will be refunded and your seat will be released.`,
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
            
            if(data.new_balance !== undefined) {
                updateBalance(data.new_balance);
            }

            loadMyBookings();
            loadMyEvents();
        } catch (err) {
            alert('Network error. Please try again.');
        }
    }

    // ═════════════════════════════════════════════════════════
    //  SAVED EVENTS
    // ═════════════════════════════════════════════════════════
    async function loadSavedEvents() {
        if(!savedEventsList) return;
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

        const pct = ev.total_seats > 0
            ? Math.round(((ev.total_seats - ev.available_seats) / ev.total_seats) * 100)
            : 100;

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
                        <span class="price-from-label">From</span>
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
                if(res.ok) {
                    card.classList.add('fade-out');
                    setTimeout(() => {
                        card.remove();
                        const remaining = savedEventsList.querySelectorAll('.event-card').length;
                        if (remaining === 0) {
                            savedEventsEmpty.classList.remove('hidden');
                        }
                    }, 300);
                }
            } catch(e) {}
        });

        return card;
    }

    // ═════════════════════════════════════════════════════════
    //  MODALS (Form & Confirm)
    // ═════════════════════════════════════════════════════════
    function openEventFormModal() {
        eventFormModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    function closeEventFormModal() {
        eventFormModal.classList.add('hidden');
        document.body.style.overflow = '';
    }

    if(eventFormClose) eventFormClose.addEventListener('click', closeEventFormModal);
    if(eventFormCancel) eventFormCancel.addEventListener('click', closeEventFormModal);
    if(eventFormBackdrop) eventFormBackdrop.addEventListener('click', closeEventFormModal);

    // Setup file input change preview
    const imageInput = document.getElementById('eventImage');
    if (imageInput) {
        imageInput.addEventListener('change', function() {
            const file = this.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    if (eventFormImagePreview && eventFormImagePreviewContainer) {
                        eventFormImagePreview.src = e.target.result;
                        eventFormImagePreviewContainer.style.display = 'block';
                    }
                };
                reader.readAsDataURL(file);
            } else {
                if (eventFormImagePreviewContainer && eventFormImagePreview) {
                    if (!eventFormImagePreview.src.startsWith('http') && !eventFormImagePreview.src.startsWith('uploads/')) {
                        eventFormImagePreviewContainer.style.display = 'none';
                    }
                }
            }
        });
    }

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

    if(confirmYes) confirmYes.addEventListener('click', () => {
        if (confirmCallback) confirmCallback();
        closeConfirm();
    });

    if(confirmNo) confirmNo.addEventListener('click', closeConfirm);
    if(confirmBackdrop) confirmBackdrop.addEventListener('click', closeConfirm);

    // ═════════════════════════════════════════════════════════
    //  HELPERS
    // ═════════════════════════════════════════════════════════
    function clearFormMessages() {
        if(!eventFormError) return;
        eventFormError.style.display = 'none';
        eventFormError.textContent = '';
        eventFormSuccess.style.display = 'none';
        eventFormSuccess.textContent = '';
    }

    function showFormError(msg) {
        eventFormError.textContent = msg;
        eventFormError.style.display = 'block';
    }

    function showFormSuccess(msg) {
        eventFormSuccess.textContent = msg;
        eventFormSuccess.style.display = 'block';
    }

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

    // ─── Boot ───────────────────────────────────────────────
    init();

})();
