'use strict';
const { uploadToCloudinary } = require('../middleware/upload');
var Event  = require('../models/Event');
var crypto = require('crypto');

// ================================================
//   GET ALL EVENTS — Public
// ================================================

async function getAllEvents(req, res) {
  try {
    var filter = { status: { $ne: 'cancelled' } };

    if (req.query.type === 'free')   filter.eventType = 'free';
    if (req.query.type === 'paid')   filter.eventType = 'paid';

    if (req.query.when === 'upcoming') {
      filter.eventDate = { $gte: new Date() };
    } else if (req.query.when === 'past') {
      filter.eventDate = { $lt: new Date() };
    }

    if (req.query.university) {
      filter.university = new RegExp(req.query.university, 'i');
    }
    if (req.query.search) {
      var q = new RegExp(req.query.search, 'i');
      filter.$or = [{ title: q }, { location: q }, { university: q }, { description: q }];
    }

    var events = await Event.find(filter)
      .select('-purchases -wallet')
      .sort({ eventDate: 1 });

    return res.json({ success: true, count: events.length, events: events });
  } catch (err) {
    console.error('[Event] getAllEvents:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ================================================
//   GET SINGLE EVENT — Public
// ================================================

async function getEventById(req, res) {
  try {
    var event = await Event.findById(req.params.id).select('-purchases -wallet');
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

// ================================================
//   GET MY EVENTS — Protected
// ================================================

async function getMyEvents(req, res) {
  try {
    var events = await Event.find({ organizer: req.user._id })
      .sort({ createdAt: -1 });

    var eventsWithStats = events.map(function (ev) {
      var obj           = ev.toObject({ virtuals: true });
      obj.ticketsSold   = ev.purchases.length;
      obj.grossRevenue  = ev.purchases.reduce(function (s, p) { return s + (p.amountPaid||0); }, 0);
      // Remove full purchase list from summary
      delete obj.purchases;
      return obj;
    });

    return res.json({ success: true, count: events.length, events: eventsWithStats });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ================================================
//   CREATE EVENT — Protected
// ================================================

async function createEvent(req, res) {
  try {
    console.log('[Event] createEvent — user:', req.user.email);
    console.log('[Event] body:', JSON.stringify(req.body));

    var title       = (req.body.title       || '').trim();
    var description = (req.body.description || '').trim();
    var university  = (req.body.university  || '').trim();
    var location    = (req.body.location    || '').trim();
    var eventDate   = req.body.eventDate;
    var eventTime   = (req.body.eventTime   || '').trim();
    var contactInfo = (req.body.contactInfo || '').trim();
    var eventType   = req.body.eventType === 'paid' ? 'paid' : 'free';
    var coverImage = '';
    if (req.file) {
      var coverRes = await uploadToCloudinary(
        req.file.buffer, 'imc/events', 'image'
      );
      coverImage = coverRes.secure_url;
    }

    router.post(
  '/',
  protect,
  uploadImage.single('coverImage'),
  eventController.createEvent
);

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
        message: 'Missing required fields: ' + missing.join(', ')
      });
    }

    // Build ticket types if provided
    var ticketTypes = [];
    if (req.body.ticketTypes && Array.isArray(req.body.ticketTypes)) {
      ticketTypes = req.body.ticketTypes.map(function (t) {
        var qty = parseInt(t.quantity) || 1;
        return {
          name:        (t.name || 'General').trim(),
          description: t.description || '',
          price:       parseFloat(t.price) || 0,
          isFree:      (parseFloat(t.price) || 0) === 0,
          quantity:    qty,
          remaining:   qty
        };
      });
    }

    // If paid event and no ticket types provided, add default
    if (eventType === 'paid' && ticketTypes.length === 0) {
      var defaultPrice = parseFloat(req.body.ticketPrice) || 0;
      var defaultQty   = parseInt(req.body.ticketQuantity) || 100;
      ticketTypes.push({
        name:      'General Admission',
        price:     defaultPrice,
        isFree:    defaultPrice === 0,
        quantity:  defaultQty,
        remaining: defaultQty
      });
    }

    var event = await Event.create({
      organizer:      req.user._id,
      organizerName:  (req.user.firstName || '') + ' ' + (req.user.lastName || ''),
      organizerEmail: req.user.email,
      title, description, university, location,
      eventDate:   new Date(eventDate),
      eventTime, contactInfo, coverImage, eventType,
      ticketTypes: ticketTypes,
      status:      'published'
    });

    console.log('[Event] ✅ Created:', event.title, '| ID:', event._id);

    return res.status(201).json({
      success: true,
      message: 'Event created successfully!',
      event:   event
    });
  } catch (err) {
    console.error('[Event] createEvent error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ================================================
//   UPDATE EVENT — Protected (organizer only)
// ================================================

async function updateEvent(req, res) {
  try {
    var event = await Event.findOne({ _id: req.params.id, organizer: req.user._id });
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found or not yours.' });
    }

    var updatable = ['title','description','university','location',
                     'eventDate','eventTime','contactInfo','coverImage','status'];
    updatable.forEach(function (f) {
      if (req.body[f] !== undefined) event[f] = req.body[f];
    });

    if (req.cloudinaryUrl) event.coverImage = req.cloudinaryUrl;

    await event.save();
    return res.json({ success: true, message: 'Event updated.', event: event });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ================================================
//   DELETE EVENT — Protected (organizer only)
// ================================================

async function deleteEvent(req, res) {
  try {
    var event = await Event.findOneAndDelete({
      _id:       req.params.id,
      organizer: req.user._id
    });
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found or not yours.' });
    }
    return res.json({ success: true, message: 'Event deleted.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ================================================
//   PURCHASE TICKET — Protected
// ================================================

async function purchaseTicket(req, res) {
  try {
    var event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    var ticketTypeId = req.params.ticketTypeId;
    var ticketType   = event.ticketTypes.id(ticketTypeId);

    if (!ticketType) {
      return res.status(404).json({ success: false, message: 'Ticket type not found.' });
    }

    if (ticketType.remaining <= 0) {
      return res.status(400).json({ success: false, message: 'Tickets sold out.' });
    }

    // Check already bought
    var alreadyBought = event.purchases.find(function (p) {
      return p.buyerEmail === req.user.email &&
             p.ticketTypeId.toString() === ticketTypeId;
    });

    if (alreadyBought) {
      return res.status(400).json({
        success:    false,
        message:    'You already have this ticket.',
        ticketCode: alreadyBought.ticketCode
      });
    }

    var paymentRef = (req.body.paymentRef || '').trim();

    if (!ticketType.isFree && ticketType.price > 0 && !paymentRef) {
      return res.status(400).json({
        success: false,
        message: 'Payment reference required for paid tickets.'
      });
    }

    // Generate unique ticket code
    var ticketCode = 'IMC-EVT-' + crypto.randomBytes(6).toString('hex').toUpperCase();

    // Calculate commission
    var commission  = event.commission || 10;
    var amountPaid  = ticketType.price;
    var platformCut = Math.round(amountPaid * commission / 100);
    var creatorEarn = amountPaid - platformCut;

    // Add purchase
    event.purchases.push({
      buyer:          req.user._id,
      buyerEmail:     req.user.email,
      buyerName:      (req.user.firstName || '') + ' ' + (req.user.lastName || ''),
      ticketTypeId:   ticketTypeId,
      ticketTypeName: ticketType.name,
      ticketCode:     ticketCode,
      paymentRef:     paymentRef,
      amountPaid:     amountPaid
    });

    // Reduce remaining
    ticketType.remaining = Math.max(0, ticketType.remaining - 1);

    // Credit creator wallet
    if (creatorEarn > 0) {
      if (!event.wallet) event.wallet = { balance: 0, totalEarned: 0 };
      event.wallet.balance     = (event.wallet.balance     || 0) + creatorEarn;
      event.wallet.totalEarned = (event.wallet.totalEarned || 0) + creatorEarn;
    }

    await event.save();

    console.log('[Ticket] ✅ Purchased:', ticketCode, '| buyer:', req.user.email);

    return res.json({
      success:        true,
      message:        'Ticket purchased successfully!',
      ticketCode:     ticketCode,
      ticketType:     ticketType.name,
      amountPaid:     amountPaid,
      event:          event.title
    });
  } catch (err) {
    console.error('[Ticket] Purchase error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ================================================
//   GET MY TICKETS — Protected
// ================================================

async function getMyTickets(req, res) {
  try {
    var events = await Event.find({
      'purchases.buyerEmail': req.user.email
    }).select('title eventDate eventTime location university purchases ticketTypes');

    var myTickets = [];
    events.forEach(function (ev) {
      ev.purchases.forEach(function (p) {
        if (p.buyerEmail === req.user.email) {
          myTickets.push({
            ticketCode:    p.ticketCode,
            ticketType:    p.ticketTypeName,
            amountPaid:    p.amountPaid,
            purchasedAt:   p.purchasedAt,
            eventTitle:    ev.title,
            eventDate:     ev.eventDate,
            eventTime:     ev.eventTime,
            eventLocation: ev.location,
            eventId:       ev._id
          });
        }
      });
    });

    return res.json({ success: true, count: myTickets.length, tickets: myTickets });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ================================================
//   GET EVENT ANALYTICS — Protected (organizer)
// ================================================

async function getEventAnalytics(req, res) {
  try {
    var event = await Event.findOne({
      _id: req.params.id, organizer: req.user._id
    });

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    var ticketBreakdown = {};
    event.ticketTypes.forEach(function (tt) {
      ticketBreakdown[tt.name] = {
        total:     tt.quantity,
        remaining: tt.remaining,
        sold:      tt.quantity - tt.remaining,
        price:     tt.price,
        revenue:   (tt.quantity - tt.remaining) * tt.price
      };
    });

    return res.json({
      success:    true,
      analytics: {
        eventTitle:    event.title,
        totalSold:     event.purchases.length,
        grossRevenue:  event.purchases.reduce(function (s, p) { return s + (p.amountPaid||0); }, 0),
        walletBalance: event.wallet ? (event.wallet.balance || 0) : 0,
        totalEarned:   event.wallet ? (event.wallet.totalEarned || 0) : 0,
        views:         event.views || 0,
        ticketBreakdown: ticketBreakdown,
        attendees:     event.purchases.map(function (p) {
          return {
            name:      p.buyerName,
            email:     p.buyerEmail,
            ticket:    p.ticketTypeName,
            code:      p.ticketCode,
            paidAt:    p.purchasedAt,
            amount:    p.amountPaid
          };
        })
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ================================================
//   REQUEST WITHDRAWAL — Protected (organizer)
// ================================================

async function requestWithdrawal(req, res) {
  try {
    var event = await Event.findOne({ _id: req.params.id, organizer: req.user._id });
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    var amount      = parseFloat(req.body.amount)      || 0;
    var bankName    = (req.body.bankName    || '').trim();
    var accountName = (req.body.accountName || '').trim();
    var accountNum  = (req.body.accountNum  || '').trim();

    if (!amount || !bankName || !accountName || !accountNum) {
      return res.status(400).json({
        success: false,
        message: 'Amount, bank name, account name and account number are required.'
      });
    }

    var balance = event.wallet ? (event.wallet.balance || 0) : 0;

    if (amount > balance) {
      return res.status(400).json({
        success: false,
        message: 'Amount exceeds available balance of ₦' + balance.toLocaleString()
      });
    }

    if (!event.wallet) event.wallet = { balance: 0, totalEarned: 0, withdrawals: [] };

    event.wallet.withdrawals.push({
      amount, bankName, accountName, accountNum, status: 'pending'
    });

    event.wallet.balance = balance - amount;
    await event.save();

    return res.json({ success: true, message: 'Withdrawal request submitted!' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ================================================
//   ADD TICKET TYPE — Protected (organizer)
// ================================================

async function addTicketType(req, res) {
  try {
    var event = await Event.findOne({ _id: req.params.id, organizer: req.user._id });
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    var name        = (req.body.name || '').trim();
    var price       = parseFloat(req.body.price) || 0;
    var quantity    = parseInt(req.body.quantity) || 1;
    var description = (req.body.description || '').trim();

    if (!name || quantity < 1) {
      return res.status(400).json({
        success: false, message: 'Ticket name and quantity required.'
      });
    }

    event.ticketTypes.push({
      name, description, price,
      isFree: price === 0,
      quantity, remaining: quantity
    });

    await event.save();
    return res.json({ success: true, message: 'Ticket type added!', event: event });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getAllEvents,
  getEventById,
  getMyEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  purchaseTicket,
  getMyTickets,
  getEventAnalytics,
  requestWithdrawal,
  addTicketType
};