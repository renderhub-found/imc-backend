'use strict';

var express   = require('express');
var router    = express.Router();
var ctrl      = require('../controllers/eventController');
var { protect } = require('../middleware/auth');

console.log('[Event Routes] Loading...');

// Public
router.get('/',            ctrl.getAllEvents);
router.get('/my-tickets',  protect, ctrl.getMyTickets);
router.get('/my-events',   protect, ctrl.getMyEvents);

// Protected
router.post('/',           protect, ctrl.createEvent);

// Dynamic LAST
router.get('/:id',         ctrl.getEventById);
router.put('/:id',         protect, ctrl.updateEvent);
router.delete('/:id',      protect, ctrl.deleteEvent);
router.post('/:id/tickets',              protect, ctrl.createTicket);
router.post('/:id/tickets/:ticketId/purchase', protect, ctrl.purchaseTicket);

console.log('[Event Routes] All registered');

module.exports = router;