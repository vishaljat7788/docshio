# NavoNavoCar

A carpooling website built with Node.js, Express and EJS. Data is stored in `data/db.json` instead of a database.

## Run it
```
npm install
npm start
```
Open http://localhost:3000

Demo login: `demo@navonavocar.in` / `demo1234`

## Features
Search rides, publish rides, book (instant or with approval), cancel, driver accept/decline, ride alerts, sign up / log in, FAQ.

## Before going live
Add a real database (MongoDB/PostgreSQL), HTTPS, CSRF protection, rate limiting, email/SMS and a payment gateway (e.g. Razorpay).
