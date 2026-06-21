<footer class="site-footer">
    <div class="site-footer__inner container">
        <div class="site-footer__grid">
            <!-- Brand Column -->
            <div class="site-footer__col site-footer__col--brand">
                <span class="site-footer__brand">EventHub</span>
                <p class="site-footer__desc">Your premium platform for discovering and booking the best local events, conferences, and cultural celebrations.</p>
            </div>
            
            <!-- Quick Links Column -->
            <div class="site-footer__col">
                <h4 class="site-footer__title">Explore</h4>
                <ul class="site-footer__links">
                    <li><a href="index.php">Home</a></li>
                    <li><a href="index.php#events-grid">Browse Events</a></li>
                    <li><a href="index.php#categories">Categories</a></li>
                    <li><a href="index.php#location-pills">Trending</a></li>
                </ul>
            </div>
            
            <!-- Support & Legal Column -->
            <div class="site-footer__col">
                <h4 class="site-footer__title">Support</h4>
                <ul class="site-footer__links">
                    <li><a href="#">Contact Us</a></li>
                    <li><a href="#">FAQ</a></li>
                    <li><a href="#">Terms of Service</a></li>
                    <li><a href="#">Privacy Policy</a></li>
                </ul>
            </div>
            
            <!-- Subscribe Column -->
            <div class="site-footer__col site-footer__col--subscribe">
                <h4 class="site-footer__title">Stay Updated</h4>
                <form class="site-footer__form" onsubmit="event.preventDefault(); alert('Subscribed successfully!');">
                    <input type="email" placeholder="Email Address" required class="site-footer__input">
                    <button type="submit" class="site-footer__btn">Subscribe</button>
                </form>
            </div>
        </div>
        
        <hr class="site-footer__divider">
        
        <div class="site-footer__bottom">
            <span class="site-footer__copy">&copy; 2026 EventHub. All rights reserved.</span>
            <div class="site-footer__socials">
                <a href="#" aria-label="Facebook">Facebook</a>
                <a href="#" aria-label="Instagram">Instagram</a>
                <a href="#" aria-label="X">X</a>
            </div>
        </div>
    </div>
</footer>

<style>
.site-footer {
    background-color: #0B0F19; /* Deep Navy */
    color: #FFFFFF;
    padding: 4rem 0 2rem 0;
    margin-top: 4rem;
    font-family: 'Poppins', 'Inter', sans-serif;
    width: 100vw;
    margin-left: calc(-50vw + 50%);
    box-sizing: border-box;
}

.site-footer__inner {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 1.5rem;
}

.site-footer__grid {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr 2fr;
    gap: 2rem;
}

.site-footer__col {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
}

.site-footer__brand {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 1.8rem;
    font-weight: 700;
    color: #D4AF37; /* Gold */
}

.site-footer__desc {
    color: #94A3B8; /* Light gray */
    font-size: 0.95rem;
    line-height: 1.6;
    margin: 0;
}

.site-footer__title {
    font-size: 1.1rem;
    font-weight: 600;
    color: #FFFFFF;
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

.site-footer__links {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.site-footer__links a {
    color: #94A3B8;
    text-decoration: none;
    font-size: 0.95rem;
    transition: color 0.2s ease;
}

.site-footer__links a:hover {
    color: #D4AF37; /* Gold */
}

.site-footer__form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-width: 320px;
}

.site-footer__input {
    width: 100%;
    padding: 0.75rem 1rem;
    background-color: #FFFFFF;
    color: #0B0F19;
    border: 1px solid #E2E8F0;
    border-radius: 6px;
    font-size: 0.95rem;
    outline: none;
}

.site-footer__btn {
    padding: 0.75rem 1.5rem;
    background-color: #D4AF37; /* Gold */
    color: #0B0F19;
    font-weight: 600;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.95rem;
    text-align: center;
    transition: background-color 0.2s ease;
}

.site-footer__btn:hover {
    background-color: #B59025; /* Gold hover */
}

.site-footer__divider {
    border: 0;
    height: 1px;
    background-color: rgba(226, 232, 240, 0.15); /* Thin, low-opacity line */
    margin: 3rem 0 1.5rem 0;
}

.site-footer__bottom {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 1rem;
}

.site-footer__copy {
    color: #94A3B8;
    font-size: 0.9rem;
}

.site-footer__socials {
    display: flex;
    gap: 1.5rem;
}

.site-footer__socials a {
    color: #94A3B8;
    text-decoration: none;
    font-size: 0.9rem;
    transition: color 0.2s ease;
}

.site-footer__socials a:hover {
    color: #D4AF37; /* Gold */
}

/* Responsive breakpoints */
@media (max-width: 992px) {
    .site-footer__grid {
        grid-template-columns: 1fr 1fr;
    }
    .site-footer__col--brand,
    .site-footer__col--subscribe {
        grid-column: span 2;
    }
}

@media (max-width: 576px) {
    .site-footer {
        padding: 3rem 0 1.5rem 0;
    }
    .site-footer__grid {
        grid-template-columns: 1fr;
    }
    .site-footer__col--brand,
    .site-footer__col--subscribe {
        grid-column: span 1;
    }
    .site-footer__bottom {
        flex-direction: column;
        text-align: center;
    }
}
</style>
