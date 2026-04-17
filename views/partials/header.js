<nav class="navbar">
    <div class="nav-container">
        <a href="/" class="logo">
            <span class="logo-icon">🌑</span>
            <span class="small-caps">ShadowHub</span>
        </a>
        
        <button class="menu-toggle" aria-label="Toggle menu">
            <span></span>
            <span></span>
            <span></span>
        </button>
        
        <div class="nav-links">
            <a href="/" class="<%= typeof currentPage !== 'undefined' && currentPage === 'home' ? 'active' : '' %>">Home</a>
            <a href="/plugins" class="<%= typeof currentPage !== 'undefined' && currentPage === 'plugins' ? 'active' : '' %>">Plugins</a>
            <% if (typeof user !== 'undefined' && user) { %>
                <% if (user.role === 'admin') { %>
                    <a href="/admin" class="<%= typeof currentPage !== 'undefined' && currentPage === 'admin' ? 'active' : '' %>">Admin</a>
                <% } %>
                <a href="/auth/logout" class="btn btn-outline" style="padding:0.4rem 1rem;font-size:0.9rem">Logout</a>
            <% } else { %>
                <a href="/auth/login" class="btn btn-outline" style="padding:0.4rem 1rem;font-size:0.9rem">Login</a>
                <a href="/auth/signup" class="btn" style="padding:0.4rem 1rem;font-size:0.9rem">Sign Up</a>
            <% } %>
        </div>
    </div>
</nav>
