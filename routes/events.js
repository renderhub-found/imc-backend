'use strict';

var express     = require('express');
var router      = express.Router();
var ctrl        = require('../controllers/eventController');
var { protect } = require('../middleware/auth');

console.log('[Event Routes] Registering...');

// ---- Public ----
router.get('/', ctrl.getAllEvents);

// ---- Protected static — BEFORE /:id ----
router.get('/my-events',  protect, ctrl.getMyEvents);
router.get('/my-tickets', protect, ctrl.getMyTickets);
router.post('/',          protect, ctrl.createEvent);

// ---- Dynamic /:id routes ----
router.get('/:id',                                          ctrl.getEventById);
router.put('/:id',                                 protect, ctrl.updateEvent);
router.delete('/:id',                              protect, ctrl.deleteEvent);
router.get('/:id/analytics',                       protect, ctrl.getEventAnalytics);
router.post('/:id/withdraw',                       protect, ctrl.requestWithdrawal);
router.post('/:id/tickets',                        protect, ctrl.addTicketType);
router.post('/:id/verify-ticket',                  protect, ctrl.verifyTicket);
router.post('/:id/tickets/:ticketTypeId/purchase', protect, ctrl.purchaseTicket);

console.log('[Event Routes] ✅ All registered');

module.exports = router;