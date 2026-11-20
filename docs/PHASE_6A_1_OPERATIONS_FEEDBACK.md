# TazaTokri — Phase 6A.1: Operations Feedback & Persona Guide

**Target Application:** TazaTokri Monorepo  
**Operational Phase:** 6A.1 Family & Staff Pilot  
**Target Audience:** Shop Owner, Store Staff, Delivery Crew, Pilot Customers

---

## 1. Persona-Driven Operational Feedback

### 1.1 Store Owner / Admin Perspective

#### Operational Workflow:
1. **Morning Price Initialization (06:00 – 07:00 IST):**
   - The owner logs into the Staff Portal under `ROLE_OWNER`.
   - Access the **Pricing Management** page to review yesterday's prices and set today's rates based on morning mandi auction arrivals.
   - *Observation:* System defaults ensure vegetables without new price entries cannot be accidentally sold at ₹0.00.
2. **Order Review & Route Dispatch (14:00 – 16:00 IST):**
   - Review incoming online orders in **Delivery Management**.
   - Assign orders to active delivery drivers (`ROLE_DELIVERY`).
   - If a driver encounters vehicle breakdown or route congestion, the owner uses the **Reassign** capability to cleanly revoke the previous attempt and assign to a secondary driver without losing order state.
3. **Evening Cash & Stock Settlement (20:00 – 21:00 IST):**
   - Navigate to **Cash Settlement** to audit cash collected by delivery drivers and POS cashiers.
   - Enforce driver cash handovers against system-calculated COD collections before marking shifts settled.
   - Review the **Daily Business Intelligence Report** for net margin, top-selling items, and total wastage.

#### Key Recommendations for the Owner:
- Keep emergency manual OTP override strictly restricted to Owner and trusted Staff for accountability.
- Require daily physical verification of high-shrinkage vegetables (leafy greens, tomatoes) against system stock.

---

### 1.2 Shop Staff & POS Operator Perspective

#### Operational Workflow:
1. **Morning Stock Intake (06:30 – 07:30 IST):**
   - Record vegetable lot weights received from the supplier using **Stock Inward**.
   - System registers integer quantities for bunch items (Coriander, Methi, Spinach) and decimal kg quantities for root and fruiting vegetables.
2. **Counter Quick Sale / POS (All Day):**
   - Staff use the touch-optimized Quick Sale screen.
   - Support for decimal weights (e.g., `0.250 kg`, `0.750 kg`) calculates line totals automatically.
   - The double-click protection (`clientRef` idempotency) guarantees that if staff double-taps "Complete Cash Sale" on a touch monitor, stock is only deducted once.
3. **Order Packing & Weight Adjustment (15:00 – 17:30 IST):**
   - When packing online customer orders, staff weigh real vegetables.
   - If an ordered 1.000 kg cabbage weighs 1.050 kg, the packing adjustment interface records the actual packed weight and recalculates the final total within the 20% tolerance limit.
4. **End-of-Day Wastage Logging:**
   - Cull damaged or spoiled vegetables and record them under **Wastage** with mandatory reason notes (`SPOILED`, `DAMAGED_IN_TRANSIT`).

---

### 1.3 Pilot Customer Perspective

#### Operational Workflow:
1. **Vegetable Discovery & Search:**
   - Customers can search in English (`Tomato`, `Spinach`), Marathi (`टोमॅटो`, `पालक`, `कोथिंबीर`), Hindi (`टमाटर`), or phonetic Romanized text (`kothimbir`, `batata`).
   - Search autocomplete and localized category tabs make browsing intuitive for non-technical family members.
2. **Cart Building & Business Rules Transparency:**
   - The cart dynamically informs the customer of order rules:
     - Orders below ₹150 display an explicit notification: *"Add ₹X more to reach the minimum order of ₹150."*
     - Orders between ₹150 and ₹299 clearly display the ₹30 delivery fee.
     - Orders of ₹300 or above display a green badge: *"Free Delivery Unlocked!"*
3. **Cutoff Clarity:**
   - Orders placed before 18:00 IST show same-day evening delivery.
   - Orders placed at or after 18:00 IST show next-day delivery date upfront before checkout.
4. **Order Tracking & Delivery OTP:**
   - On dispatch, customers receive the driver's name and a 6-digit delivery confirmation OTP.
   - Sharing the OTP with the driver confirms item receipt and payment.

---

### 1.4 Delivery Crew Perspective

#### Operational Workflow:
1. **Shift Login & Active Order Sheet:**
   - Drivers log into the PWA on mobile phones (`ROLE_DELIVERY`).
   - The "My Deliveries" tab displays assigned orders grouped by locality/pincode (`411026`, `411039`) with customer address and phone number.
2. **Starting Delivery Trip:**
   - Driver taps **"Start Delivery"** on the assigned order. Order status updates in real-time to `OUT_FOR_DELIVERY`.
3. **Customer Handshake & Handover:**
   - At customer doorstep, driver requests the 6-digit OTP received by the customer.
   - Driver inputs the OTP into the app. System verifies against the encrypted hash.
   - *Network Outage Protocol:* If the customer has poor mobile connectivity or cannot access WhatsApp, driver contacts store staff to authorize a manual override with audit reason.
4. **Cash Collection & Completion:**
   - For Cash on Delivery orders, driver collects the exact amount due shown on screen.
   - If enabled by store policy, driver snaps a photo of the delivered grocery basket at the door as Proof of Delivery (POD).
   - Driver marks order **"Delivered"**.

---

## 2. Family & Staff Pilot Day-1 Operational Checklist

Prior to inviting family and staff to place real pilot orders, complete the following steps:

- [ ] **Bootstrap Owner Account:** Ensure the primary owner phone number and credentials are set via environment variables.
- [ ] **Configure Shop Address & Delivery Zones:** Verify serviceable PIN codes (`411026, 411039`) match pilot delivery coverage.
- [ ] **Set Morning Prices:** Input baseline retail prices for all available vegetables.
- [ ] **Create Delivery Staff Accounts:** Pre-create driver logins for Sunil and Ajay with `ROLE_DELIVERY`.
- [ ] **Staff Training Session (15 minutes):**
  - Walk shop staff through POS counter sale entry.
  - Demonstrate order packing adjustment screen.
  - Review how to log damaged vegetables.
- [ ] **Driver Briefing (10 minutes):**
  - Show drivers how to start trips and verify OTPs on mobile browsers.
  - Instruct drivers on exact cash handling and end-of-day settlement.
- [ ] **Customer Onboarding (Family Pilot Group):**
  - Share PWA link with family members.
  - Explain the ₹150 minimum, ₹30 fee, ₹300 free delivery, and 6 PM cutoff rules.
