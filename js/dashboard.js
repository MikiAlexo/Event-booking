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
    const eventFormDesc    = document.getElementById('event-form-desc');
    const eventFormError   = document.getElementById('event-form-error');
    const eventFormSuccess = document.getElementById('event-form-success');
    const eventFormSubmit  = document.getElementById('event-form-submit');

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
    }

    // ─── Auth Check ─────────────────────────────────────────
    async function checkAuth() {
        try {
            const res  = await fetch(`${API_AUTH}?action=check`);
            const data = await res.json();
            if (data.logged_in) {
                currentUser = data.user;
                navUserName.textContent = `Hi, ${currentUser.full_name}`;
                return true;
            }
        } catch (e) { /* no-op */ }
        return false;
    }

    // ─── Logout ─────────────────────────────────────────────
    navLogout.addEventListener('click', async () => {
        await fetch(`${API_AUTH}?action=logout`);
        localStorage.removeItem('user');
        window.location.href = 'auth.html';
    });

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

            if (!events.length) {
                myEventsEmpty.classList.remove('hidden');
                return;
            }

            events.forEach(ev => myEventsList.appendChild(createMyEventRow(ev)));
        } catch (e) {
            myEventsEmpty.classList.remove('hidden');
        }
    }

    function createMyEventRow(ev) {
        const row = document.createElement('div');
        row.className = 'event-row';

        const dateObj = new Date(ev.event_date);
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
                    <span>📅 ${dateStr} at ${timeStr}</span>
                    <span>🎟️ ${booked} / ${ev.total_seats} booked</span>
                </p>
            </div>
            <div class="event-row__actions">
                <button class="btn btn--sm btn--outline edit-event-btn" data-id="${ev.id}"><span>Edit</span></button>
                <button class="btn btn--sm btn--danger-outline delete-event-btn" data-id="${ev.id}"><span>Delete</span></button>
            </div>
        `;

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
    btnNewEvent.addEventListener('click', () => {
        eventFormTitle.textContent = 'Create New Event';
        eventFormSubmit.textContent = 'Create Event';
        eventFormSubmit.dataset.label = 'Create Event';
        eventFormId.value    = '';
        eventFormName.value  = '';
        eventFormType.value  = '';
        eventFormDate.value  = '';
        eventFormSeats.value = '';
        eventFormDesc.value  = '';
        clearFormMessages();
        openEventFormModal();
    });

    // ── Edit Event ──────────────────────────────────────────
    function openEditEvent(ev) {
        eventFormTitle.textContent = 'Edit Event';
        eventFormSubmit.textContent = 'Update Event';
        eventFormSubmit.dataset.label = 'Update Event';
        eventFormId.value    = ev.id;
        eventFormName.value  = ev.title;
        eventFormType.value  = ev.event_type;
        eventFormSeats.value = ev.total_seats;
        eventFormDesc.value  = ev.description || '';

        // Format datetime-local value
        const dt = new Date(ev.event_date);
        const y  = dt.getFullYear();
        const m  = String(dt.getMonth() + 1).padStart(2, '0');
        const d  = String(dt.getDate()).padStart(2, '0');
        const h  = String(dt.getHours()).padStart(2, '0');
        const mi = String(dt.getMinutes()).padStart(2, '0');
        eventFormDate.value = `${y}-${m}-${d}T${h}:${mi}`;

        clearFormMessages();
        openEventFormModal();
    }

    // ── Save Event (Create or Update) ───────────────────────
    eventForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearFormMessages();

        const isEdit  = eventFormId.value !== '';
        const payload = {
            title:       eventFormName.value.trim(),
            event_type:  eventFormType.value,
            event_date:  eventFormDate.value,
            total_seats: parseInt(eventFormSeats.value, 10),
            description: eventFormDesc.value.trim(),
        };

        if (isEdit) payload.id = parseInt(eventFormId.value, 10);

        if (!payload.title || !payload.event_type || !payload.event_date || payload.total_seats < 1) {
            showFormError('Please fill in all required fields.');
            return;
        }

        const method = isEdit ? 'PUT' : 'POST';

        eventFormSubmit.disabled = true;
        eventFormSubmit.textContent = 'Saving…';

        try {
            const res = await fetch(API_EVENTS, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
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
        } catch (err) {
            alert('Network error. Please try again.');
        }
    }

    // ═════════════════════════════════════════════════════════
    //  MY BOOKINGS
    // ═════════════════════════════════════════════════════════
    async function loadMyBookings() {
        myBookingsList.innerHTML = '';
        myBookingsEmpty.classList.add('hidden');

        try {
            const res      = await fetch(`${API_BOOKINGS}?action=list`);
            const bookings = await res.json();

            if (!bookings.length) {
                myBookingsEmpty.classList.remove('hidden');
                return;
            }

            bookings.forEach(b => myBookingsList.appendChild(createBookingRow(b)));
        } catch (e) {
            myBookingsEmpty.classList.remove('hidden');
        }
    }

    function createBookingRow(b) {
        const row = document.createElement('div');
        row.className = 'booking-row';

        const dateObj   = new Date(b.event_date);
        const dateStr   = dateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        const timeStr   = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        const bookedOn  = new Date(b.booking_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        const isCancelled = b.status === 'cancelled';

        row.innerHTML = `
            <div class="booking-row__info">
                <h3 class="booking-row__title ${isCancelled ? 'cancelled-text' : ''}">${escapeHtml(b.title)}</h3>
                <p class="booking-row__meta">
                    <span class="badge badge--${b.event_type.toLowerCase()}">${escapeHtml(b.event_type)}</span>
                    <span>📅 ${dateStr} at ${timeStr}</span>
                    <span>🎟️ Booked on ${bookedOn}</span>
                </p>
            </div>
            <div class="booking-row__actions">
                <span class="booking-status booking-status--${b.status}">${b.status === 'active' ? 'Active' : 'Cancelled'}</span>
                ${!isCancelled ? `<button class="btn btn--sm btn--danger-outline cancel-booking-btn" data-id="${b.booking_id}"><span>Cancel</span></button>` : ''}
            </div>
        `;

        if (!isCancelled) {
            row.querySelector('.cancel-booking-btn').addEventListener('click', () => {
                showConfirm(
                    'Cancel Booking',
                    `Cancel your booking for "${escapeHtml(b.title)}"? Your seat will be released.`,
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

            loadMyBookings();
            loadMyEvents();
        } catch (err) {
            alert('Network error. Please try again.');
        }
    }

    // ═════════════════════════════════════════════════════════
    //  MODALS
    // ═════════════════════════════════════════════════════════
    function openEventFormModal() {
        eventFormModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    function closeEventFormModal() {
        eventFormModal.classList.add('hidden');
        document.body.style.overflow = '';
    }

    eventFormClose.addEventListener('click', closeEventFormModal);
    eventFormCancel.addEventListener('click', closeEventFormModal);
    eventFormBackdrop.addEventListener('click', closeEventFormModal);

    // ── Confirm Dialog ──────────────────────────────────────
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

    confirmYes.addEventListener('click', () => {
        if (confirmCallback) confirmCallback();
        closeConfirm();
    });

    confirmNo.addEventListener('click', closeConfirm);
    confirmBackdrop.addEventListener('click', closeConfirm);

    // ═════════════════════════════════════════════════════════
    //  HELPERS
    // ═════════════════════════════════════════════════════════
    function clearFormMessages() {
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
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ─── Boot ───────────────────────────────────────────────
    init();

})();
