/**
 * events.js - Home page event listing, filtering, and booking trigger
 */

(function () {
    'use strict';

    const API_EVENTS   = 'api/events.php';
    const API_AUTH     = 'api/auth.php';
    const API_BOOKINGS = 'api/bookings.php';

    // ─── DOM ────────────────────────────────────────────────
    const eventsGrid    = document.getElementById('events-grid');
    const eventsEmpty   = document.getElementById('events-empty');
    const eventsLoading = document.getElementById('events-loading');

    const filterSearch   = document.getElementById('filter-search');
    const filterType     = document.getElementById('filter-type');
    const filterDateFrom = document.getElementById('filter-date-from');
    const filterDateTo   = document.getElementById('filter-date-to');
    const filterBtn      = document.getElementById('filter-btn');
    const filterReset    = document.getElementById('filter-reset');

    // Modal
    const modal          = document.getElementById('event-modal');
    const modalBackdrop  = document.getElementById('modal-backdrop');
    const modalClose     = document.getElementById('modal-close');
    const modalType      = document.getElementById('modal-type');
    const modalTitle     = document.getElementById('modal-title');
    const modalDate      = document.getElementById('modal-date');
    const modalHost      = document.getElementById('modal-host');
    const modalDesc      = document.getElementById('modal-desc');
    const modalSeatsBar  = document.getElementById('modal-seats-bar');
    const modalSeatsText = document.getElementById('modal-seats-text');
    const modalBookBtn   = document.getElementById('modal-book-btn');
    const modalMessage   = document.getElementById('modal-message');

    // Nav auth elements
    const navGuest  = document.getElementById('nav-guest');
    const navUser   = document.getElementById('nav-user');
    const navLogout = document.getElementById('nav-logout');

    let currentUser = null;
    let selectedEventId = null;

    // ─── Init ───────────────────────────────────────────────
    async function init() {
        await checkAuth();
        loadEvents();
    }

    // ─── Auth Check ─────────────────────────────────────────
    async function checkAuth() {
        try {
            const res  = await fetch(`${API_AUTH}?action=check`);
            const data = await res.json();
            if (data.logged_in) {
                currentUser = data.user;
                navGuest.classList.add('hidden');
                navUser.classList.remove('hidden');
            } else {
                currentUser = null;
                navGuest.classList.remove('hidden');
                navUser.classList.add('hidden');
            }
        } catch (e) {
            currentUser = null;
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

    // ─── Load Events ────────────────────────────────────────
    async function loadEvents(params) {
        eventsLoading.classList.remove('hidden');
        eventsGrid.innerHTML = '';
        eventsEmpty.classList.add('hidden');

        const query = new URLSearchParams(params || {});

        try {
            const res    = await fetch(`${API_EVENTS}?${query}`);
            const events = await res.json();

            eventsLoading.classList.add('hidden');

            if (!events.length) {
                eventsEmpty.classList.remove('hidden');
                return;
            }

            events.forEach(ev => {
                eventsGrid.appendChild(createEventCard(ev));
            });

        } catch (err) {
            eventsLoading.classList.add('hidden');
            eventsEmpty.classList.remove('hidden');
        }
    }

    // ─── Create Event Card ──────────────────────────────────
    function createEventCard(ev) {
        const card = document.createElement('div');
        card.className = 'event-card';
        card.dataset.id = ev.id;

        const dateObj = new Date(ev.event_date);
        const month   = dateObj.toLocaleString('en-US', { month: 'short' }).toUpperCase();
        const day     = dateObj.getDate();
        const time    = dateObj.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

        const pct = ev.total_seats > 0
            ? Math.round(((ev.total_seats - ev.available_seats) / ev.total_seats) * 100)
            : 100;

        const seatsClass = ev.available_seats <= 0 ? 'sold-out' : (pct >= 80 ? 'almost-full' : '');

        card.innerHTML = `
            <div class="event-card__date-badge">
                <span class="event-card__month">${month}</span>
                <span class="event-card__day">${day}</span>
            </div>
            <div class="event-card__body">
                <span class="event-card__type">${escapeHtml(ev.event_type)}</span>
                <h3 class="event-card__title">${escapeHtml(ev.title)}</h3>
                <p class="event-card__time">${time}</p>
                <p class="event-card__host">by ${escapeHtml(ev.creator_name)}</p>
                <div class="event-card__footer">
                    <span class="event-card__seats ${seatsClass}">
                        ${ev.available_seats <= 0 ? 'Sold Out' : ev.available_seats + ' seats left'}
                    </span>
                    <button class="btn btn--sm btn--primary event-card__view-btn"><span>View</span></button>
                </div>
            </div>
        `;

        card.querySelector('.event-card__view-btn').addEventListener('click', () => openModal(ev));
        return card;
    }

    // ─── Modal ──────────────────────────────────────────────
    function openModal(ev) {
        selectedEventId = ev.id;

        modalType.textContent = ev.event_type;
        modalTitle.textContent = ev.title;

        const dateObj = new Date(ev.event_date);
        modalDate.textContent = dateObj.toLocaleString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            hour: 'numeric', minute: '2-digit', hour12: true
        });
        modalHost.textContent = 'Hosted by ' + ev.creator_name;
        modalDesc.textContent = ev.description || 'No description provided.';

        const pct = ev.total_seats > 0
            ? Math.round(((ev.total_seats - ev.available_seats) / ev.total_seats) * 100)
            : 100;

        modalSeatsBar.style.width = pct + '%';
        modalSeatsBar.className = 'seats-bar__fill' + (pct >= 80 ? ' seats-bar__fill--danger' : '');
        modalSeatsText.textContent = `${ev.available_seats} / ${ev.total_seats} seats available`;

        if (ev.available_seats <= 0) {
            modalBookBtn.disabled = true;
            modalBookBtn.textContent = 'Sold Out';
        } else {
            modalBookBtn.disabled = false;
            modalBookBtn.textContent = 'Book Now';
        }

        modalMessage.style.display = 'none';
        modalMessage.textContent = '';

        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
        selectedEventId = null;
    }

    modalClose.addEventListener('click', closeModal);
    modalBackdrop.addEventListener('click', closeModal);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });

    // ─── Book Event ─────────────────────────────────────────
    modalBookBtn.addEventListener('click', async () => {
        if (!currentUser) {
            window.location.href = 'auth.html';
            return;
        }

        modalBookBtn.disabled = true;
        modalBookBtn.textContent = 'Booking…';
        modalMessage.style.display = 'none';

        try {
            const res = await fetch(`${API_BOOKINGS}?action=book`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ event_id: selectedEventId }),
            });

            const data = await res.json();

            if (!res.ok) {
                modalMessage.textContent = data.error || 'Booking failed.';
                modalMessage.style.display = 'block';
                modalBookBtn.disabled = false;
                modalBookBtn.textContent = 'Book Now';
                return;
            }

            modalMessage.className = 'auth-success';
            modalMessage.textContent = 'Booking confirmed! Check your dashboard for details.';
            modalMessage.style.display = 'block';

            // Refresh events after a short delay
            setTimeout(() => {
                closeModal();
                loadEvents(getFilterParams());
            }, 1500);

        } catch (err) {
            modalMessage.textContent = 'Network error. Please try again.';
            modalMessage.style.display = 'block';
            modalBookBtn.disabled = false;
            modalBookBtn.textContent = 'Book Now';
        }
    });

    // ─── Filters ────────────────────────────────────────────
    function getFilterParams() {
        const params = {};
        const search   = filterSearch.value.trim();
        const type     = filterType.value;
        const dateFrom = filterDateFrom.value;
        const dateTo   = filterDateTo.value;

        if (search)   params.search    = search;
        if (type)     params.type      = type;
        if (dateFrom) params.date_from = dateFrom;
        if (dateTo)   params.date_to   = dateTo;

        return params;
    }

    filterBtn.addEventListener('click', () => loadEvents(getFilterParams()));

    filterReset.addEventListener('click', () => {
        filterSearch.value   = '';
        filterType.value     = '';
        filterType.dispatchEvent(new Event('change'));
        filterDateFrom.value = '';
        filterDateTo.value   = '';
        loadEvents();
    });

    // Allow Enter key in search
    filterSearch.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') loadEvents(getFilterParams());
    });

    // ─── Utility ────────────────────────────────────────────
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ─── Boot ───────────────────────────────────────────────
    init();

})();
