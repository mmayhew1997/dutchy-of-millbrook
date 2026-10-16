// ===== Order Book preview =====
// Open tracker.html?demo to skip sign-in and browse example orders.
// Swaps the Supabase client for an in-memory stand-in: edits work while the
// page is open, but nothing is saved and nothing leaves the browser.
// Without ?demo the page behaves normally (real sign-in).
(() => {
  if (!new URLSearchParams(location.search).has('demo')) return;

  const day = (n) => {
    const d = new Date(); d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  };
  const ago = (n) => new Date(Date.now() - n * 864e5).toISOString();
  let nextId = 100;
  const order = (o) => ({ id: nextId++, paid: false, ...o });

  let rows = [
    order({ customer_name: 'Olivia Hart', email: 'olivia.hart@example.com', phone: '(212) 555-0148',
      cake_type: 'charm', status: 'Inquiry', occasion: '40th birthday', date_needed: day(19), created_at: ago(1),
      total: 850, deposit: 0,
      details: 'Size: 10″ — serves 22–24\nFlavor: chocolate · Filling: raspberry jam\nSides: bows\nCharms: 1. tennis racket 2. golden retriever 3. Nantucket lighthouse 4. martini 5. stack of books\nInscription: Happy 40th, Liv\nPickup: Upper West Side',
      notes: 'Sending a photo of the dog. Follow up Friday to confirm the date.' }),
    order({ customer_name: 'James Whitaker', email: 'j.whitaker@example.com', phone: '(917) 555-0193',
      cake_type: 'wedding', status: 'Inquiry', occasion: 'Wedding — 120 guests', date_needed: day(150), created_at: ago(2),
      total: 2500, deposit: 0,
      details: 'Tiers: 3\nGuest count: 120\nFlavor: white · Filling: lemon curd\nVision: white and green trellis, garden roses\nVenue: Millbrook, NY\nDelivery address: Millbrook, NY 12545',
      notes: 'Tasting requested. Venue needs delivery by 2 pm.' }),
    order({ customer_name: 'Priya Shah', email: 'priya.shah@example.com', phone: '(646) 555-0172',
      cake_type: 'needlepoint', status: 'Confirmed', occasion: 'Baby shower', date_needed: day(9), created_at: ago(6),
      total: 650, deposit: 300,
      details: 'Size: 8″ — serves 12–16\nFlavor: white · Filling: passion fruit\nColors: pink, yellow, blue\nInscription: Welcome, Baby Shah\nPickup: Upper West Side',
      notes: 'Deposit received by Venmo. Balance due at pickup.' }),
    order({ customer_name: 'Sarah Morgan', email: 'sarah.morgan@example.com', phone: '(203) 555-0116',
      cake_type: 'charm', status: 'Confirmed', occasion: 'Graduation', date_needed: day(14), created_at: ago(8),
      total: 850, deposit: 425,
      details: 'Size: 10″ — serves 22–24\nFlavor: chocolate · Filling: chocolate hazelnut\nSides: tassels\nCharms: 1. diploma 2. lacrosse stick 3. Vermont mountains 4. golden retriever\nInscription: Congrats, Charlie!\nDelivery address: Greenwich, CT',
      notes: 'Delivery quoted at $75 — added to total.' }),
    order({ customer_name: 'Claire Dubois', email: 'claire.dubois@example.com', phone: '(845) 555-0134',
      cake_type: 'trellis', status: 'Baking', occasion: 'Anniversary', date_needed: day(2), created_at: ago(15),
      total: 650, deposit: 650, paid: true,
      details: 'Size: 8″ — serves 12–16\nFlavor: white · Filling: cherry jam\nTrellis: green with cherries\nInscription: 25 Years\nPickup: Millbrook, Saturday',
      notes: 'Paid in full. Pickup Saturday 11 am.' }),
    order({ customer_name: 'Ben Alvarez', email: 'ben.alvarez@example.com', phone: '(917) 555-0187',
      cake_type: 'charm', status: 'Ready', occasion: 'Retirement', date_needed: day(1), created_at: ago(20),
      total: 850, deposit: 425,
      details: 'Size: 10″ — serves 22–24\nFlavor: white · Filling: lemon curd\nSides: bows\nCharms: 1. sailboat 2. golf flag 3. reading glasses 4. coffee cup\nInscription: Happy Retirement, Dad\nPickup: Upper West Side',
      notes: 'Pickup Thursday evening. Collect $425 balance.' }),
    order({ customer_name: 'Hannah Lee', email: 'hannah.lee@example.com', phone: '(212) 555-0161',
      cake_type: 'other', status: 'Delivered', occasion: 'Book club', date_needed: day(-6), created_at: ago(30),
      total: 650, deposit: 650, paid: true,
      details: 'Size: 8″ — serves 12–16\nFlavor: chocolate · Filling: chocolate ganache\nIdea: book-spine cake with six favorite titles\nPickup: Upper West Side',
      notes: 'Loved it — said she would post on Instagram.' }),
    order({ customer_name: 'Grace Thompson', email: 'grace.t@example.com', phone: '(518) 555-0109',
      cake_type: 'charm', status: 'Delivered', occasion: '30th birthday', date_needed: day(-21), created_at: ago(45),
      total: 650, deposit: 650, paid: true,
      details: 'Size: 8″ — serves 12–16\nFlavor: white · Filling: raspberry jam\nSides: tassels\nCharms: 1. ski poles 2. champagne 3. tabby cat\nInscription: Dirty Thirty\nPickup: Millbrook, Sunday',
      notes: 'Repeat customer.' }),
  ];

  const listeners = [];
  const changed = () => listeners.forEach((fn) => fn());
  const ok = (data = null) => Promise.resolve({ data, error: null });

  const table = () => ({
    select: () => ok(rows.map((r) => ({ ...r }))),
    insert: (o) => { rows.push(order({ created_at: new Date().toISOString(), ...o })); changed(); return ok(); },
    update: (patch) => ({ eq: (_k, id) => { rows = rows.map((r) => (r.id === id ? { ...r, ...patch } : r)); return ok(); } }),
    delete: () => ({ eq: (_k, id) => { rows = rows.filter((r) => r.id !== id); return ok(); } }),
  });

  const session = { user: { email: 'preview' } };
  sb = {
    auth: {
      getSession: () => ok({ session }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signInWithPassword: () => ok({ session }),
      signOut: () => { location.href = 'tracker.html'; return ok(); },
    },
    from: () => table(),
    channel: () => {
      const ch = { on: (_a, _b, fn) => { listeners.push(fn); return ch; }, subscribe: () => ch };
      return ch;
    },
  };
})();
