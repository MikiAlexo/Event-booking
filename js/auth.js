/**
 * auth.js - Client-side authentication handling
 * Manages login/register forms using the Fetch API.
 */

(function () {
    'use strict';

    const API_BASE = 'api/auth.php';

    // ─── DOM Elements ───────────────────────────────────────
    const loginCard    = document.getElementById('login-card');
    const registerCard = document.getElementById('register-card');
    const toggleBtns   = document.querySelectorAll('[data-toggle-auth]');

    const loginForm    = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

    const loginError    = document.getElementById('login-error');
    const registerError = document.getElementById('register-error');

    // ─── Toggle Between Login & Register ────────────────────
    toggleBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            loginCard.classList.toggle('hidden');
            registerCard.classList.toggle('hidden');
            clearErrors();
        });
    });

    function clearErrors() {
        if (loginError) loginError.textContent = '';
        if (registerError) registerError.textContent = '';
    }

    function showError(el, message) {
        if (el) {
            el.textContent = message;
            el.style.display = 'block';
        }
    }

    function setLoading(form, loading) {
        const btn = form.querySelector('button[type="submit"]');
        if (btn) {
            btn.disabled = loading;
            btn.textContent = loading ? 'Please wait…' : btn.dataset.label;
        }
    }

    // ─── Login Handler ──────────────────────────────────────
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearErrors();
            setLoading(loginForm, true);

            const email    = loginForm.querySelector('#login-email').value.trim();
            const password = loginForm.querySelector('#login-password').value;

            try {
                const res = await fetch(`${API_BASE}?action=login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password }),
                });

                const data = await res.json();

                if (!res.ok) {
                    showError(loginError, data.error || 'Login failed.');
                    return;
                }

                // Store basic user info for quick access
                localStorage.setItem('user', JSON.stringify(data.user));
                window.location.href = 'index.php';

            } catch (err) {
                showError(loginError, 'Network error. Please try again.');
            } finally {
                setLoading(loginForm, false);
            }
        });
    }

    // ─── Register Handler ───────────────────────────────────
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearErrors();
            setLoading(registerForm, true);

            const fullName = registerForm.querySelector('#register-name').value.trim();
            const email    = registerForm.querySelector('#register-email').value.trim();
            const password = registerForm.querySelector('#register-password').value;
            const confirm  = registerForm.querySelector('#register-confirm').value;

            // Client-side validation
            if (password !== confirm) {
                showError(registerError, 'Passwords do not match.');
                setLoading(registerForm, false);
                return;
            }

            if (password.length < 6) {
                showError(registerError, 'Password must be at least 6 characters.');
                setLoading(registerForm, false);
                return;
            }

            try {
                const res = await fetch(`${API_BASE}?action=register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ full_name: fullName, email, password }),
                });

                const data = await res.json();

                if (!res.ok) {
                    showError(registerError, data.error || 'Registration failed.');
                    return;
                }

                localStorage.setItem('user', JSON.stringify(data.user));
                window.location.href = 'index.php';

            } catch (err) {
                showError(registerError, 'Network error. Please try again.');
            } finally {
                setLoading(registerForm, false);
            }
        });
    }

})();
