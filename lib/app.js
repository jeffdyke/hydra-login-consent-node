"use strict";
// Copyright © 2025 Ory Corp
// SPDX-License-Identifier: Apache-2.0
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = __importDefault(require("express"));
var path_1 = __importDefault(require("path"));
var morgan_1 = __importDefault(require("morgan"));
var cookie_parser_1 = __importDefault(require("cookie-parser"));
var body_parser_1 = __importDefault(require("body-parser"));
var express_session_1 = __importDefault(require("express-session"));
var connect_pg_simple_1 = __importDefault(require("connect-pg-simple"));
var routes_1 = __importDefault(require("./routes"));
var login_1 = __importDefault(require("./routes/login"));
var logout_1 = __importDefault(require("./routes/logout"));
var consent_1 = __importDefault(require("./routes/consent"));
var device_1 = __importDefault(require("./routes/device"));
var callback_1 = __importDefault(require("./routes/callback"));
var config_1 = require("./config");
var app = (0, express_1.default)();
var PgStore = (0, connect_pg_simple_1.default)(express_session_1.default);
// view engine setup
app.set("views", path_1.default.join(__dirname, "..", "views"));
app.set("view engine", "pug");
// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use((0, morgan_1.default)("dev"));
app.use(body_parser_1.default.json());
app.use(body_parser_1.default.urlencoded({ extended: false }));
app.use((0, cookie_parser_1.default)());
// Session middleware with PostgreSQL store
app.use((0, express_session_1.default)({
    store: new PgStore({
        conObject: config_1.pgConfig,
        tableName: "session",
        createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || "change-me-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        sameSite: "lax",
    },
}));
app.use(express_1.default.static(path_1.default.join(__dirname, "public")));
app.use("/", routes_1.default);
app.use("/login", login_1.default);
app.use("/logout", logout_1.default);
app.use("/consent", consent_1.default);
app.use("/device", device_1.default);
app.use("/callback", callback_1.default);
// catch 404 and forward to error handler
app.use(function (req, res, next) {
    next(new Error("Generic Not Found"));
});
// error handlers
// development error handler
// will print stacktrace
if (app.get("env") === "development") {
    app.use(function (err, req, res) {
        res.status(500);
        res.render("error", {
            message: err.message,
            error: err,
        });
    });
}
// production error handler
// no stacktraces leaked to user
app.use(function (err, req, res) {
    res.status(500);
    res.render("error", {
        message: err.message,
        error: {},
    });
});
app.use(function (err, req, res, next) {
    console.error(err.stack);
    res.status(500).render("error", {
        message: JSON.stringify(err, null, 2),
    });
});
var listenOn = Number(process.env.PORT || 3000);
app.listen(listenOn, function () {
    console.log("Listening on http://0.0.0.0:".concat(listenOn));
});
