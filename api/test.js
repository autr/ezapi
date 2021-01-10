const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
// NEW
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
var crypto = require('crypto');
// ---


const MongoStore = require('connect-mongo')(session);
require('dotenv').config();
var app = express();
const connection = mongoose.createConnection(process.env.DB_STRING);
const UserSchema = new mongoose.Schema({
    username: String,
    hash: String,
    salt: String
});
mongoose.model('User', UserSchema);
const sessionStore = new MongoStore({ mongooseConnection: connection, collection: 'sessions' })
app.use(session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: true,
    store: sessionStore 
}));




// NEW
// START PASSPORT
function validPassword(password, hash, salt) {
    var hashVerify = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return hash === hashVerify;
}
function genPassword(password) {
    var salt = crypto.randomBytes(32).toString('hex');
    var genHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    
    return {
      salt: salt,
      hash: genHash
    };
}
passport.use(new LocalStrategy(
    function(username, password, cb) {
        User.findOne({ username: username })
            .then((user) => {
                if (!user) { return cb(null, false) }
                
                // Function defined at bottom of app.js
                const isValid = validPassword(password, user.hash, user.salt);
                
                if (isValid) {
                    return cb(null, user);
                } else {
                    return cb(null, false);
                }
            })
            .catch((err) => {   
                cb(err);
            });
}));
passport.serializeUser(function(user, cb) {
    cb(null, user.id);
});
passport.deserializeUser(function(id, cb) {
    User.findById(id, function (err, user) {
        if (err) { return cb(err); }
        cb(null, user);
    });
});
app.use(passport.initialize());
app.use(passport.session());
// --- 
// END PASSPORT






app.get('/login', (req, res, next) => {
    res.send('<h1>Login Page</h1>');
});
app.post('/login', (req, res, next) => {});
app.get('/register', (req, res, next) => {
    res.send('<h1>Register Page</h1>');
});
app.post('/register', (req, res, next) => {});
app.listen(3000);