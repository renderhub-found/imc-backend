'use strict';

var Event  = require('../models/Event');
var Ticket = require('../models/Ticket');
var crypto = require('crypto');

// GET /api/events
async function getAllEvents(req, res) {
  try {
    var filter = { status: 'published' };
    if (req.query.university) {
      filter.university = new RegExp(req.query.university, 'i');
    }
    if (req.query.search) {
      var q = new RegExp(req.query.search, 'i');
      filter.$or = [{ title: q }, { location: q }, { university: q }];
    }

    var events = await Event.find(filter)
      .sort({ eventDate: 1 })
      .select('-ticketTypes');

    return res.json({ success: true, count: events.length, events: events });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// GET /api/events/my-events
async function getMyEvents(req, res) {
  try {
    var events = await Event.find({ organizer: req.user._id })
      .sort({ createdAt: -1 });
    return res.json({ success: true, count: events.length, events: events });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// GET /api/events/:id
async function getEventById(req, res) {
  try {
    var event = await Event.findById(req.params.id)
      .populate('ticketTypes');

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    event.views = (event.views || 0) + 1;
    await event.save();

    return res.json({ success: true, event: event });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// POST /api/events
async function createEvent(req, res) {
  try {
    var title       = (req.body.title       || '').trim();
    var description = (req.body.description || '').trim();
    var university  = (req.body.university  || '').trim();
    var location    = (req.body.location    || '').trim();
    var eventDate   = req.body.eventDate;
    var eventTime   = (req.body.eventTime   || '').trim();
    var contactInfo = (req.body.contactInfo || '').trim();
    var coverImage  = req.cloudinaryUrl || (req.body.coverImage || '').trim();

    var missing = [];
    if (!title)      missing.push('title');
    if (!description)missing.push('description');
    if (!university) missing.push('university');
    if (!location)   missing.push('location');
    if (!eventDate)  missing.push('eventDate');
    if (!eventTime)  missing.push('eventTime');

    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Missing fields: ' + missing.join(', ')
      });
    }

    var event = await Event.create({
      organizer:      req.user._id,
      organizerName:  req.user.firstName + ' ' + (req.user.lastName || ''),
      organizerEmail: req.user.email,
      title, description, university, location,
      eventDate: new Date(eventDate),
      eventTime, contactInfo, coverImage,
      status: 'published'
    });

    console.log('[Event] Created:', event.title, '| ID:', event._id);

    return res.status(201).json({ success: true, message: 'Event created!', event: event });
  } catch (err) {
    console.error('[Event] Create error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// PUT /api/events/:id
async function updateEvent(req, res) {
  try {
    var event = await Event.findOne({
      _id: req.params.id,
      organizer: req.user._id
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found or not yours.'
      });
    }

    var fields = ['title','description','university','location',
                  'eventDate','eventTime','contactInfo','coverImage','status'];
    fields.forEach(function (f) {
      if (req.body[f] !== undefined) event[f] = req.body[f];
    });

    if (req.cloudinaryUrl) event.coverImage = req.cloudinaryUrl;

    await event.save();
    return res.json({ success: true, message: 'Event updated.', event: event });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// DELETE /api/events/:id
async function deleteEvent(req, res) {
  try {
    var event = await Event.findOneAndDelete({
      _id:       req.params.id,
      organizer: req.user._id
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found or not yours.'
      });
    }

    // Delete associated tickets
    await Ticket.deleteMany({ event: req.params.id });

    return res.json({ success: true, message: 'Event deleted.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// POST /api/events/:id/tickets
async function createTicket(req, res) {
  try {
    var event = await Event.findOne({
      _id:       req.params.id,
      organizer: req.user._id
    });

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    var name        = (req.body.name || '').trim();
    var price       = parseFloat(req.body.price) || 0;
    var quantity    = parseInt(req.body.quantity) || 1;
    var description = (req.body.description || '').trim();

    if (!name || quantity < 1) {
      return res.status(400).json({
        success: false,
        message: 'Ticket name and quantity are required.'
      });
    }

    var ticket = await Ticket.create({
      event:       event._id,
      name,
      description,
      price,
      isFree:    price === 0,
      quantity,
      remaining: quantity
    });

    event.ticketTypes.push(ticket._id);
    await event.save();

    return res.status(201).json({
      success: true,
      message: 'Ticket type created!',
      ticket:  ticket
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// POST /api/events/:id/tickets/:ticketId/purchase
async function purchaseTicket(req, res) {
  try {
    var ticket = await Ticket.findById(req.params.ticketId);

    if (!ticket || ticket.event.toString() !== req.params.id) {
      return res.status(404).json({ success: false, message: 'Ticket not found.' });
    }

    if (ticket.remaining <= 0) {
      return res.status(400).json({ success: false, message: 'Tickets sold out.' });
    }

    // Check not already purchased
    var alreadyBought = ticket.purchases.find(function (p) {
      return p.buyerEmail === req.user.email;
    });

    if (alreadyBought) {
      return res.status(400).json({
        success: false,
        message: 'You already have a ticket for this event.',
        ticketId: alreadyBought.ticketId
      });
    }

    // Generate unique ticket ID
    var uniqueId   = 'TKT-' + crypto.randomBytes(6).toString('hex').toUpperCase();
    var paymentRef = req.body.paymentRef || (ticket.isFree ? 'FREE' : '');

    if (!ticket.isFree && !paymentRef) {
      return res.status(400).json({
        success: false,
        message: 'Payment reference required for paid tickets.'
      });
    }

    ticket.purchases.push({
      buyer:      req.user._id,
      buyerEmail: req.user.email,
      buyerName:  req.user.firstName + ' ' + (req.user.lastName || ''),
      ticketId:   uniqueId,
      paymentRef: paymentRef
    });

    ticket.remaining = Math.max(0, ticket.remaining - 1);
    await ticket.save();

    console.log('[Ticket] Purchased:', uniqueId, '| buyer:', req.user.email);

    return res.status(200).json({
      success:    true,
      message:    'Ticket purchased!',
      ticketId:   uniqueId,
      ticketName: ticket.name,
      price:      ticket.price
    });
  } catch (err) {
    console.error('[Ticket] Purchase error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// GET /api/events/my-tickets
async function getMyTickets(req, res) {
  try {
    var tickets = await Ticket.find({
      'purchases.buyerEmail': req.user.email
    }).populate('event', 'title eventDate eventTime location university');

    var myTickets = [];
    tickets.forEach(function (t) {
      t.purchases.forEach(function (p) {
        if (p.buyerEmail === req.user.email) {
          myTickets.push({
            ticketId:    p.ticketId,
            ticketName:  t.name,
            ticketPrice: t.price,
            isFree:      t.isFree,
            event:       t.event,
            purchasedAt: p.paidAt
          });
        }
      });
    });

    return res.json({ success: true, count: myTickets.length, tickets: myTickets });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getAllEvents, getMyEvents, getEventById,
  createEvent, updateEvent, deleteEvent,
  createTicket, purchaseTicket, getMyTickets
};