-- ============================================================
-- Oh my Gogh! — seed content (real, production-grade copy)
-- Run AFTER schema.sql. Idempotent: upserts by id, safe to re-run.
-- Prices are whole rupees (INR) — Razorpay's home currency.
-- Swap in your own products / photos later from the admin.
-- ============================================================

-- ---- products ----------------------------------------------------------
insert into public.products (id,name,cat,price,inventory,status,tint,medium,artist,sizes,sold,blurb,position) values
('p1','Starry Night Crew Tee','Apparel',1499,48,'published','20,42,84','Cotton · Screen Print','Mira Vance', array['S','M','L','XL'],64,'Heavyweight 240gsm organic cotton with a hand-pulled swirl print that climbs from the front hem up over the shoulder. Garment-dyed and pre-shrunk, it only gets better every wash.',1),
('p2','Sunflower Field Hoodie','Apparel',3499,23,'published','224,169,58','Fleece · Embroidered','Juno Okafor', array['S','M','L','XL'],41,'Brushed-back fleece in chrome yellow with a tonal sunflower embroidered over the heart. Heavy, warm, and impossible to take off once it is on.',2),
('p3','Wheatfield Canvas Tote','Accessories',999,120,'published','46,138,134','Canvas · Block Print','Émile Roux', array['One'],88,'12oz natural canvas, hand block-printed with a wheat motif, a boxed base and an inside pocket for your sketchbook. Built to outlive every other bag you own.',3),
('p4','Sable Round Brush Set','Art Supplies',1899,7,'published','20,42,84','Set of 6 · Sable','Atelier OMG', array['One'],29,'Six pure sable rounds, sizes 000 through 8, on balanced birch handles. The exact set we reach for in the studio every single day.',4),
('p5','Chrome Yellow Oil Set','Art Supplies',2199,0,'draft','224,169,58','Oils · 12 Tubes','Atelier OMG', array['One'],18,'A twelve-tube oil set built around the yellows Vincent loved, milled with a little extra pigment load so a single stroke really means it.',5),
('p6','Almond Blossom Tee','Apparel',1499,34,'published','46,138,134','Cotton · Screen Print','Lena Park', array['S','M','L','XL'],37,'A soft-hand discharge print of blossoming branches on a sea-glass teal tee. Light enough for summer, loud enough for any season.',6),
('p7','Impasto Knit Beanie','Accessories',1099,52,'published','224,169,58','Merino · Hand-Knit','Lena Park', array['One'],46,'Chunky hand-knit merino with a textured cable that mimics thick brushwork. Warm, a little wild, and entirely yours.',7),
('p8','The Gogh Letters','Books',799,14,'draft','20,42,84','Hardcover · 248pp','Atelier OMG', array['One'],12,'A pocket hardcover of our favourite letters between the lines — annotated by the studio and printed on heavy uncoated stock.',8)
on conflict (id) do update set
  name=excluded.name, cat=excluded.cat, price=excluded.price, inventory=excluded.inventory,
  status=excluded.status, tint=excluded.tint, medium=excluded.medium, artist=excluded.artist,
  sizes=excluded.sizes, sold=excluded.sold, blurb=excluded.blurb, position=excluded.position;

-- ---- artists -----------------------------------------------------------
insert into public.artists (id,name,medium,location,tint,quote,bio_text,instagram,portfolio,featured,status,position) values
('art1','Mira Vance','Textile Painter','Arles, France','46,138,134','Color is the only language I never had to learn.','From a converted barn outside Arles, Mira dyes her own wool in batches no bigger than a soup pot. Our spring capsule is her first wearable collection — six pieces, each a single continuous thread.','@miravance','miravance.com',true,'active',1),
('art2','Juno Okafor','Oil & Impasto','Lagos, Nigeria','224,169,58','Paint should arrive before the image does.','Juno works in oils thick enough that you feel a canvas before you read it. He built our sunflower capsule around a single chrome yellow he mixes by hand.','@junookafor','',true,'active',2),
('art3','Lena Park','Pigment & Ceramic','Seoul, South Korea','192,86,30','I chase the exact color of a memory I can almost place.','Lena moves between pigment and clay, hunting hues that feel half-remembered. Her blossom prints and knit pieces carry the soft, washed light of early spring.','@lenapark_studio','lenapark.kr',false,'active',3),
('art4','Émile Roux','Printmaker','Lyon, France','20,42,84','Repetition is not boredom — it is devotion.','Émile block-prints by hand, one pull at a time, on heavy natural canvas. He believes a motif only earns its place once you have cut it a hundred times.','@emileroux','',false,'active',4)
on conflict (id) do update set
  name=excluded.name, medium=excluded.medium, location=excluded.location, tint=excluded.tint,
  quote=excluded.quote, bio_text=excluded.bio_text, instagram=excluded.instagram,
  portfolio=excluded.portfolio, featured=excluded.featured, status=excluded.status, position=excluded.position;

-- ---- journal -----------------------------------------------------------
insert into public.journal_posts (id,title,cat,read_time,author,date,excerpt,body_text,status,tint) values
('a1','The Chemistry of Chrome Yellow','Materials','6 min read','Atelier OMG','Jun 24, 2026','Why Van Gogh''s brightest pigment was also his most fragile — and how a modern mill keeps it singing.','Of all the colours Vincent reached for, chrome yellow was the loudest and the most reckless.

Lead chromate is a brilliant, opaque yellow that mixes fast and dries faster. That speed is exactly why it fades.

We cannot bring back what time has taken from the originals. What we can do is choose a modern, lightfast yellow that sings the same note without the same fate.','published','224,169,58'),
('a2','Inside Mira Vance''s Thread Studio','Spotlight','8 min read','Atelier OMG','Jun 12, 2026','A morning among the looms with the textile painter behind our spring drop.','Mira Vance''s studio is a converted barn an hour outside Arles, and it smells like wet wool and eucalyptus.

She dyes everything herself, in pots no bigger than you would use for soup. Nothing matches exactly, and that is the point.','published','46,138,134'),
('a3','How to Wear a Painting','Style','4 min read','Atelier OMG','May 30, 2026','Five ways to style loud, painterly pieces without tipping into costume.','A painterly piece can tip into costume fast. The trick is to let one loud thing be the whole outfit.

If the print is doing the talking, everything else should whisper: raw denim, unbleached cotton, a flat leather sandal.','published','192,86,30'),
('a4','Impasto on Fabric: A Field Guide','Technique','7 min read','Atelier OMG','May 16, 2026','The textures we chase, the threads that hold them, and the failures along the way.','Thick paint wants to crack, and fabric wants to move. Putting impasto texture on something you can wear is a small war between the two.','draft','20,42,84')
on conflict (id) do update set
  title=excluded.title, cat=excluded.cat, read_time=excluded.read_time, author=excluded.author,
  date=excluded.date, excerpt=excluded.excerpt, body_text=excluded.body_text, status=excluded.status, tint=excluded.tint;

-- ---- collections -------------------------------------------------------
insert into public.collections (id,name,description,product_ids,status,position) values
('col1','Spring Drop','The first seasonal capsule — six wearables from Mira Vance''s loom.', array['p1','p2','p6'],'published',1),
('col2','Van Gogh Essentials','The pieces that started it all. Each one a nod to the master.', array['p1','p3','p7'],'published',2),
('col3','Studio Supplies','Tools for the studio, chosen with the same care as the wearables.', array['p4','p5'],'published',3),
('col4','Summer Reads','For the long afternoon. Books that belong in a bag.', array['p8'],'draft',4)
on conflict (id) do update set
  name=excluded.name, description=excluded.description, product_ids=excluded.product_ids, status=excluded.status, position=excluded.position;

-- ---- discounts ---------------------------------------------------------
insert into public.discounts (id,code,type,value,"limit",used,expires,active) values
('d1','STARRY','pct',15,100,47,'2026-12-31',true),
('d2','WELCOME10','pct',10,0,234,'',true),
('d3','SUNFLOWER','fixed',200,50,23,'2026-07-31',true),
('d4','STUDIO2025','pct',20,30,30,'2025-12-31',false)
on conflict (id) do update set
  code=excluded.code, type=excluded.type, value=excluded.value, "limit"=excluded."limit",
  used=excluded.used, expires=excluded.expires, active=excluded.active;

-- ---- customers ---------------------------------------------------------
insert into public.customers (id,name,email,location,since,ltv,order_count,avg,status,note) values
('c1','Ava Lindqvist','ava@studio.se','Stockholm, SE','Jan 2025',6994,2,3497,'active',''),
('c2','Marcus Bell','m.bell@gmail.com','Brooklyn, NY','Mar 2025',3499,1,3499,'active',''),
('c3','Yuki Tanaka','yuki.t@me.com','Tokyo, JP','Apr 2025',7394,2,3697,'active','Ships to Japan — confirm duty rates'),
('c4','Sofia Reyes','sofia@hey.com','CDMX, MX','May 2025',1998,1,1998,'active',''),
('c5','Liam O''Connor','liam.oc@outlook.com','Dublin, IE','Jun 2025',4497,1,4497,'active','Repeat buyer — check discount usage'),
('c6','Priya Nair','priya.nair@gmail.com','Bengaluru, IN','Feb 2025',1897,1,1897,'active','')
on conflict (id) do update set
  name=excluded.name, email=excluded.email, location=excluded.location, since=excluded.since,
  ltv=excluded.ltv, order_count=excluded.order_count, avg=excluded.avg, status=excluded.status, note=excluded.note;

-- ---- orders + items ----------------------------------------------------
insert into public.orders (id,customer,email,address,date,stage,method,tracking,subtotal,shipping,total,currency) values
('#1042','Ava Lindqvist','ava@studio.se','Götgatan 12, Stockholm, SE','Jun 28',4,'Razorpay','PT9X-44820-SE',3497,0,3497,'INR'),
('#1041','Marcus Bell','m.bell@gmail.com','88 Pearl St, Brooklyn, NY','Jun 28',3,'Razorpay','1Z-OMG-77410',3499,0,3499,'INR'),
('#1040','Yuki Tanaka','yuki.t@me.com','2-4-1 Shibuya, Tokyo, JP','Jun 27',2,'Razorpay','',3697,0,3697,'INR'),
('#1039','Sofia Reyes','sofia@hey.com','Roma Norte, CDMX, MX','Jun 27',1,'Razorpay','',1899,99,1998,'INR'),
('#1038','Liam O''Connor','liam.oc@outlook.com','14 Dame St, Dublin, IE','Jun 26',0,'Razorpay','',4497,0,4497,'INR'),
('#1037','Priya Nair','priya.nair@gmail.com','Indiranagar, Bengaluru, IN','Jun 26',4,'Razorpay','BD-5521-IN',1798,99,1897,'INR')
on conflict (id) do update set
  stage=excluded.stage, tracking=excluded.tracking, subtotal=excluded.subtotal,
  shipping=excluded.shipping, total=excluded.total;

delete from public.order_items where order_id in ('#1042','#1041','#1040','#1039','#1038','#1037');
insert into public.order_items (order_id,product_id,name,size,qty,price) values
('#1042','p1','Starry Night Crew Tee','M',1,1499),
('#1042','p3','Wheatfield Canvas Tote','One',2,999),
('#1041','p2','Sunflower Field Hoodie','L',1,3499),
('#1040','p7','Impasto Knit Beanie','One',2,1099),
('#1040','p6','Almond Blossom Tee','S',1,1499),
('#1039','p4','Sable Round Brush Set','One',1,1899),
('#1038','p1','Starry Night Crew Tee','XL',3,1499),
('#1037','p3','Wheatfield Canvas Tote','One',1,999),
('#1037','p8','The Gogh Letters','One',1,799);

-- ---- settings ----------------------------------------------------------
insert into public.settings (id,store,email,currency,providers) values
(1,'Oh my Gogh!','parth@ohmygogh.com','INR (₹)','{"razorpay":{"enabled":true,"mode":"test"},"manual":{"enabled":false,"mode":"test"}}'::jsonb)
on conflict (id) do update set store=excluded.store, email=excluded.email, currency=excluded.currency;
