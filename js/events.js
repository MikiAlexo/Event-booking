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
    const filterLocation = document.getElementById('filter-location');
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
    const modalLocation  = document.getElementById('modal-location');
    const modalPrice     = document.getElementById('modal-price');
    const modalDesc      = document.getElementById('modal-desc');
    const modalSeatsBar  = document.getElementById('modal-seats-bar');
    const modalSeatsText = document.getElementById('modal-seats-text');
    const modalBookBtn   = document.getElementById('modal-book-btn');
    const modalMessage   = document.getElementById('modal-message');

    // Nav auth elements
    const navGuest   = document.getElementById('nav-guest');
    const navUser    = document.getElementById('nav-user');
    const navLogout  = document.getElementById('nav-logout');
    const navBalance = document.getElementById('nav-balance');

    let currentUser = null;
    let selectedEventId = null;
    let savedEventsIds = [];

    // ─── Init ───────────────────────────────────────────────
    async function init() {
        await checkAuth();
        if (currentUser) await loadSavedEventsIds();
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
                if(navBalance) navBalance.innerHTML = `<span>Balance: ${Number(data.user.balance).toFixed(2)} ETB</span>`;
            } else {
                currentUser = null;
                navGuest.classList.remove('hidden');
                navUser.classList.add('hidden');
            }
        } catch (e) {
            currentUser = null;
        }
    }

    async function loadSavedEventsIds() {
        try {
            const res = await fetch(`${API_EVENTS}?action=saved`);
            const data = await res.json();
            if (Array.isArray(data)) {
                savedEventsIds = data.map(e => e.id);
            }
        } catch(e) {}
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

        const dateObj = parseSQLDate(ev.event_date);
        const month   = dateObj.toLocaleString('en-US', { month: 'short' }).toUpperCase();
        const day     = dateObj.getDate();
        const time    = dateObj.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

        const pct = ev.total_seats > 0
            ? Math.round(((ev.total_seats - ev.available_seats) / ev.total_seats) * 100)
            : 100;

        const seatsClass = ev.available_seats <= 0 ? 'sold-out' : (pct >= 80 ? 'almost-full' : '');
        
        const price = Number(ev.ticket_price) > 0 ? `${Number(ev.ticket_price).toFixed(2)} ETB` : 'FREE';
        const isSaved = savedEventsIds.includes(ev.id);

        card.innerHTML = `
            <div class="event-card__date-badge">
                <span class="event-card__month">${month}</span>
                <span class="event-card__day">${day}</span>
            </div>
            <div class="event-card__body">
                <div style="margin-bottom: 0.5rem;">
                    <span class="event-card__type">${escapeHtml(ev.event_type)}</span>
                </div>
                <h3 class="event-card__title">${escapeHtml(ev.title)}</h3>
                <p class="event-card__time">${time} • ${escapeHtml(ev.location || 'Online')}</p>
                <p class="event-card__host">by ${escapeHtml(ev.creator_name)}</p>
                <div class="event-card__footer">
                    <span style="font-weight:bold; color:var(--color-primary);">${price}</span>
                    <span class="event-card__seats ${seatsClass}">
                        ${ev.available_seats <= 0 ? 'Waitlist Available' : ev.available_seats + ' seats left'}
                    </span>
                    <button class="btn btn--sm btn--primary event-card__view-btn"><span>View</span></button>
                </div>
            </div>
            <div class="ticket-stub ${isSaved ? 'hidden-stub' : ''}" title="Save Event">
                <div class="ticket-stub__content">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="0"></rect><path d="M3 10a2 2 0 0 1 0 4M21 10a2 2 0 0 0 0 4"></path></svg>
                    <span class="ticket-stub__text">KEEP</span>
                </div>
            </div>
            <div class="ticket-stamp ${isSaved ? '' : 'hidden-stub'}" title="Unsave Event">
                <div class="ticket-stamp__content">
                    <span class="ticket-stamp__text">KEPT</span>
                </div>
            </div>
        `;

        card.querySelector('.event-card__view-btn').addEventListener('click', () => openModal(ev));
        
        const stubElement = card.querySelector('.ticket-stub');
        const stampElement = card.querySelector('.ticket-stamp');

        // Ticket Rip Click Handler
        stubElement.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!currentUser) {
                window.location.href = 'auth.html';
                return;
            }
            try {
                const res = await fetch(`${API_EVENTS}?action=save`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ event_id: ev.id })
                });
                if(res.ok) {
                    if (!savedEventsIds.includes(ev.id)) {
                        savedEventsIds.push(ev.id);
                    }
                    updateModalStateIfSelected(ev.id, true);

                    stubElement.classList.add('ripping');
                    setTimeout(() => {
                        stubElement.classList.remove('ripping');
                        stubElement.classList.add('hidden-stub');
                        
                        stampElement.classList.remove('hidden-stub');
                        stampElement.classList.add('entering');
                        
                        setTimeout(() => {
                            stampElement.classList.remove('entering');
                        }, 150);
                    }, 250);
                }
            } catch(e) {}
        });

        // Ticket Stamp Unsave Handler
        stampElement.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!currentUser) {
                window.location.href = 'auth.html';
                return;
            }
            try {
                const res = await fetch(`${API_EVENTS}?action=unsave`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ event_id: ev.id })
                });
                if(res.ok) {
                    savedEventsIds = savedEventsIds.filter(id => id !== ev.id);
                    updateModalStateIfSelected(ev.id, false);

                    card.classList.add('flash-active');
                    setTimeout(() => {
                        card.classList.remove('flash-active');
                    }, 300);

                    stampElement.classList.add('hidden-stub');
                    stubElement.classList.remove('hidden-stub');
                    stubElement.classList.add('restoring');
                    
                    setTimeout(() => {
                        stubElement.classList.remove('restoring');
                    }, 300);
                }
            } catch(e) {}
        });

        return card;
    }

    // ─── Modal ──────────────────────────────────────────────
    function openModal(ev) {
        selectedEventId = ev.id;

        modalType.textContent = ev.event_type;
        modalTitle.textContent = ev.title;

        const dateObj = parseSQLDate(ev.event_date);
        modalDate.textContent = dateObj.toLocaleString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            hour: 'numeric', minute: '2-digit', hour12: true
        });
        modalHost.textContent = 'Hosted by ' + ev.creator_name;
        if(modalLocation) modalLocation.textContent = 'Location: ' + (ev.location || 'Online');
        if(modalPrice) {
            const price = Number(ev.ticket_price);
            modalPrice.textContent = 'Price: ' + (price > 0 ? price.toFixed(2) + ' ETB' : 'FREE');
        }
        modalDesc.textContent = ev.description || 'No description provided.';

        const modalSaveBtn = document.getElementById('modal-save-btn');
        if (modalSaveBtn) {
            const isSaved = savedEventsIds.includes(ev.id);
            modalSaveBtn.innerHTML = `<span>${isSaved ? 'Saved' : 'Save Event'}</span>`;
            if (isSaved) {
                modalSaveBtn.classList.remove('btn--outline');
                modalSaveBtn.classList.add('btn--primary');
            } else {
                modalSaveBtn.classList.add('btn--outline');
                modalSaveBtn.classList.remove('btn--primary');
            }
        }

        const pct = ev.total_seats > 0
            ? Math.round(((ev.total_seats - ev.available_seats) / ev.total_seats) * 100)
            : 100;

        modalSeatsBar.style.width = pct + '%';
        modalSeatsBar.className = 'seats-bar__fill' + (pct >= 80 ? ' seats-bar__fill--danger' : '');
        modalSeatsText.textContent = `${ev.available_seats} / ${ev.total_seats} seats available`;

        modalBookBtn.disabled = false;
        if (ev.available_seats <= 0) {
            modalBookBtn.textContent = 'Join Waitlist';
        } else {
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
        const isWaitlist = modalBookBtn.textContent.includes('Waitlist');
        modalBookBtn.textContent = isWaitlist ? 'Joining…' : 'Booking…';
        modalMessage.style.display = 'none';

        try {
            const res = await fetch(`${API_BOOKINGS}?action=book`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ event_id: selectedEventId }),
            });

            const data = await res.json();

            if (!res.ok) {
                modalMessage.className = 'auth-error';
                modalMessage.textContent = data.error || 'Request failed.';
                modalMessage.style.display = 'block';
                modalBookBtn.disabled = false;
                modalBookBtn.textContent = isWaitlist ? 'Join Waitlist' : 'Book Now';
                return;
            }

            modalMessage.className = 'auth-success';
            if (data.waitlist) {
                modalMessage.textContent = data.message || 'You have been added to the waitlist.';
            } else {
                modalMessage.textContent = 'Booking confirmed! Check your dashboard.';
                if(navBalance && data.new_balance !== undefined) {
                    navBalance.innerHTML = `<span>Balance: ${Number(data.new_balance).toFixed(2)} ETB</span>`;
                }
            }
            modalMessage.style.display = 'block';

            // Refresh events after a short delay
            setTimeout(() => {
                closeModal();
                loadEvents(getFilterParams());
            }, 1500);

        } catch (err) {
            modalMessage.className = 'auth-error';
            modalMessage.textContent = 'Network error. Please try again.';
            modalMessage.style.display = 'block';
            modalBookBtn.disabled = false;
            modalBookBtn.textContent = isWaitlist ? 'Join Waitlist' : 'Book Now';
        }
    });

    function updateModalStateIfSelected(eventId, isSaved) {
        if (selectedEventId === eventId && modalSaveBtn) {
            modalSaveBtn.innerHTML = `<span>${isSaved ? 'Saved' : 'Save Event'}</span>`;
            if (isSaved) {
                modalSaveBtn.classList.remove('btn--outline');
                modalSaveBtn.classList.add('btn--primary');
            } else {
                modalSaveBtn.classList.add('btn--outline');
                modalSaveBtn.classList.remove('btn--primary');
            }
        }
    }

    const modalSaveBtn = document.getElementById('modal-save-btn');
    if (modalSaveBtn) {
        modalSaveBtn.addEventListener('click', async () => {
            if (!currentUser) {
                window.location.href = 'auth.html';
                return;
            }
            if (!selectedEventId) return;
            const currentSaved = savedEventsIds.includes(selectedEventId);
            const action = currentSaved ? 'unsave' : 'save';
            modalSaveBtn.disabled = true;
            try {
                const res = await fetch(`${API_EVENTS}?action=${action}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ event_id: selectedEventId })
                });
                if(res.ok) {
                    if (currentSaved) {
                        savedEventsIds = savedEventsIds.filter(id => id !== selectedEventId);
                    } else {
                        savedEventsIds.push(selectedEventId);
                    }
                    const isNowSaved = savedEventsIds.includes(selectedEventId);
                    modalSaveBtn.innerHTML = `<span>${isNowSaved ? 'Saved' : 'Save Event'}</span>`;
                    if (isNowSaved) {
                        modalSaveBtn.classList.remove('btn--outline');
                        modalSaveBtn.classList.add('btn--primary');
                    } else {
                        modalSaveBtn.classList.add('btn--outline');
                        modalSaveBtn.classList.remove('btn--primary');
                    }
                    
                    const card = document.querySelector(`.event-card[data-id="${selectedEventId}"]`);
                    if (card) {
                        const stubElement = card.querySelector('.ticket-stub');
                        const stampElement = card.querySelector('.ticket-stamp');
                        if (stubElement && stampElement) {
                            if (isNowSaved) {
                                stubElement.classList.add('hidden-stub');
                                stampElement.classList.remove('hidden-stub');
                            } else {
                                stampElement.classList.add('hidden-stub');
                                stubElement.classList.remove('hidden-stub');
                            }
                        }
                    }
                }
            } catch(e) {
            } finally {
                modalSaveBtn.disabled = false;
            }
        });
    }

    // ─── Filters ────────────────────────────────────────────
    function getFilterParams() {
        const params = {};
        const search   = filterSearch.value.trim();
        const location = filterLocation ? filterLocation.value.trim() : '';
        const type     = filterType.value;
        const dateFrom = filterDateFrom.value;
        const dateTo   = filterDateTo.value;

        if (search)   params.search    = search;
        if (location) params.location  = location;
        if (type)     params.type      = type;
        if (dateFrom) params.date_from = dateFrom;
        if (dateTo)   params.date_to   = dateTo;

        return params;
    }

    filterBtn.addEventListener('click', () => loadEvents(getFilterParams()));

    filterReset.addEventListener('click', () => {
        filterSearch.value   = '';
        if(filterLocation) filterLocation.value = '';
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
    if(filterLocation) {
        filterLocation.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') loadEvents(getFilterParams());
        });
    }

    // ─── Utility ────────────────────────────────────────────
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
