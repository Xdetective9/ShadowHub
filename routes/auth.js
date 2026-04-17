const express = require('express');
const router = express.Router();

router.get('/signup', (req, res) => {
    if (req.session.user) return res.redirect('/');
    res.render('auth/signup', { title: 'Sign Up | ShadowHub' });
});

router.post('/signup', async (req, res, next) => {
    try {
        const { username, password, confirm } = req.body;
        
        if (!username || !password) {
            return res.render('auth/signup', {
                title: 'Sign Up | ShadowHub',
                error: 'All fields are required'
            });
        }

        if (password !== confirm) {
            return res.render('auth/signup', {
                title: 'Sign Up | ShadowHub',
                error: 'Passwords do not match'
            });
        }

        const result = await req.auth.createUser(username, password);
        if (result.error) {
            return res.render('auth/signup', {
                title: 'Sign Up | ShadowHub',
                error: result.error
            });
        }

        req.session.user = result.user;
        res.redirect('/');
    } catch (err) {
        next(err);
    }
});

router.get('/login', (req, res) => {
    if (req.session.user) return res.redirect('/');
    res.render('auth/login', { title: 'Login | ShadowHub' });
});

router.post('/login', async (req, res, next) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.render('auth/login', {
                title: 'Login | ShadowHub',
                error: 'All fields are required'
            });
        }

        const result = await req.auth.authenticate(username, password);
        if (result.error) {
            return res.render('auth/login', {
                title: 'Login | ShadowHub',
                error: result.error
            });
        }

        req.session.user = result.user;
        res.redirect('/');
    } catch (err) {
        next(err);
    }
});

router.get('/logout', (req, res) => {
    req.session.destroy(err => {
        res.clearCookie('connect.sid');
        res.redirect('/');
    });
});

module.exports = router;
