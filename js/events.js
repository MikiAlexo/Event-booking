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
    const modalImageContainer = document.getElementById('modal-image-container');
    const modalImage     = document.getElementById('modal-image');

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
                <button class="event-card__heart-btn ${isSaved ? 'saved' : ''}" title="${isSaved ? 'Unsave Event' : 'Save Event'}">
                    <svg class="heart-icon" viewBox="0 0 24 24" fill="${isSaved ? '#D4AF37' : 'none'}" stroke="${isSaved ? '#D4AF37' : '#0B0F19'}" stroke-width="2">
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

        // Click card body or button to open modal
        card.addEventListener('click', (e) => {
            if (e.target.closest('.event-card__heart-btn')) return;
            openModal(ev);
        });

        const heartBtn = card.querySelector('.event-card__heart-btn');
        heartBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!currentUser) {
                window.location.href = 'auth.html';
                return;
            }
            const currentSaved = savedEventsIds.includes(ev.id);
            const action = currentSaved ? 'unsave' : 'save';
            heartBtn.disabled = true;
            try {
                const res = await fetch(`${API_EVENTS}?action=${action}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ event_id: ev.id })
                });
                if(res.ok) {
                    if (currentSaved) {
                        savedEventsIds = savedEventsIds.filter(id => id !== ev.id);
                        heartBtn.classList.remove('saved');
                        heartBtn.querySelector('svg').setAttribute('fill', 'none');
                        heartBtn.querySelector('svg').setAttribute('stroke', '#0B0F19');
                    } else {
                        savedEventsIds.push(ev.id);
                        heartBtn.classList.add('saved');
                        heartBtn.querySelector('svg').setAttribute('fill', '#D4AF37');
                        heartBtn.querySelector('svg').setAttribute('stroke', '#D4AF37');
                    }
                    updateModalStateIfSelected(ev.id, !currentSaved);
                }
            } catch(e) {
            } finally {
                heartBtn.disabled = false;
            }
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

        if (modalImageContainer && modalImage) {
            if (ev.image_path) {
                modalImage.src = ev.image_path;
                modalImage.alt = ev.title;
                modalImageContainer.style.display = 'block';
            } else {
                modalImageContainer.style.display = 'none';
            }
        }

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
                        const heartBtn = card.querySelector('.event-card__heart-btn');
                        if (heartBtn) {
                            if (isNowSaved) {
                                heartBtn.classList.add('saved');
                                heartBtn.querySelector('svg').setAttribute('fill', '#D4AF37');
                                heartBtn.querySelector('svg').setAttribute('stroke', '#D4AF37');
                            } else {
                                heartBtn.classList.remove('saved');
                                heartBtn.querySelector('svg').setAttribute('fill', 'none');
                                heartBtn.querySelector('svg').setAttribute('stroke', '#0B0F19');
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

    // Setup carousel scroll handlers
    const eventsPrev = document.getElementById('events-prev');
    const eventsNext = document.getElementById('events-next');
    if (eventsPrev && eventsNext && eventsGrid) {
        eventsPrev.addEventListener('click', () => {
            eventsGrid.scrollBy({ left: -360, behavior: 'smooth' });
        });
        eventsNext.addEventListener('click', () => {
            eventsGrid.scrollBy({ left: 360, behavior: 'smooth' });
        });
    }

    // Setup location pills filter
    const locationPills = document.querySelectorAll('.location-pill');
    locationPills.forEach(pill => {
        pill.addEventListener('click', () => {
            locationPills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            
            const loc = pill.dataset.location;
            if (filterLocation) {
                filterLocation.value = loc;
            }
            loadEvents(getFilterParams());
        });
    });

    // Setup category cards filter
    const categoryCards = document.querySelectorAll('.category-card');
    categoryCards.forEach(card => {
        card.addEventListener('click', () => {
            const type = card.dataset.type;
            
            // Clear other search parameters to perform a clean category filter
            if (filterSearch) filterSearch.value = '';
            if (filterLocation) filterLocation.value = '';
            if (filterDateFrom) filterDateFrom.value = '';
            if (filterDateTo) filterDateTo.value = '';
            
            // Reset active location pills to "For You"
            const locationPills = document.querySelectorAll('.location-pill');
            locationPills.forEach(p => p.classList.remove('active'));
            const forYouPill = document.querySelector('.location-pill[data-location=""]');
            if (forYouPill) forYouPill.classList.add('active');

            if (filterType) {
                filterType.value = type;
            }
            
            loadEvents({ type: type });
            eventsGrid.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });

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
