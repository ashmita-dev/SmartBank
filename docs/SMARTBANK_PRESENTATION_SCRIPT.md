# SmartBank — Presentation Script (about 6 minutes)

Read naturally; you do not need to memorise every word. **[Bold brackets]** are what to click.
Start on the login page at `http://localhost:5173`, with the backend already running (see the demo guide).

---

**1. Introduction (≈30 s)**

"Good morning. My project is **SmartBank: a database-driven fraud detection and transaction monitoring system**.
It is a banking database built in Oracle, where every new transaction is checked for fraud automatically,
inside the database itself, using PL/SQL."

**2. Problem statement (≈20 s)**

"Online fraud happens fast. A fraudster may send a large amount, from a new device, from an unusual city,
several times in a few minutes. A bank needs to catch this the moment the transaction is recorded."

**3. Objective and schema (≈50 s)**

"My objective was to put the fraud rules where the data lives: in the database. Then every application
that inserts a transaction is checked in the same way.

The schema has **12 tables**. `CUSTOMER` is a supertype with two subtypes, individual and business
customers. `ACCOUNT` is also a supertype, with savings and current accounts. Transactions link an account
to a merchant and a device, and each transaction can have at most one fraud alert, which is assigned to a
fraud analyst. Primary keys, foreign keys and CHECK constraints protect the data. For example, an amount
must be positive, and an alert status can only be one of five values."

**4. Why Oracle and PL/SQL (≈20 s)**

"I chose Oracle because PL/SQL lets me write triggers, procedures, functions, cursors and packages that run
next to the data, with proper transactions. Oracle REST Data Services then turns my SQL into a REST API for
the website."

**[Fraud Analyst tab → Use demo account → type any password → Enter Analyst Console]**

"For this demo the login is a demonstration mechanism, not production authentication."

**5. Analyst console (≈50 s)**

"This is the analyst overview. These cards are live counts from Oracle: customers, accounts, transactions
and fraud alerts. The chart uses my view `V_DAILY_TRANSACTION_ANALYTICS`."

**[Transactions → type Lagos → click FLAGGED]**

"Here I can search and filter. Notice there are two columns: the payment status, and the fraud review.
A medium-risk transaction raises an alert but stays completed. Only high risk is flagged."

**[Fraud Alerts → open the top alert]**

"Each alert has a score from 0 to 100, a level, readable reasons, and the assigned analyst."

**[Analyst Workload]**

"New alerts go to the analyst with the fewest open alerts. That is done by my `GENERATE_ALERT` procedure."

**6. Live transaction (≈90 s)**

**[Sign out → Customer tab → Use demo account → any password → Sign in]**

"Now I am a customer. I only see my own accounts and transactions."

**[New Transfer → AC1000001, Amazon India, 2500, Mumbai, a device "used on this account" → Submit transfer]**

"This is a normal payment: a small amount, from my home city, on a device I have used before. The
database inserted it, and the trigger scored it. It is low risk, so there is no alert."

**[New transfer → QuickCash Loans, 150000, Lagos, a device "new for this account" → Submit transfer]**

"Now a suspicious one: a large amount, from Lagos, on a device never used on this account. The function
`CALCULATE_RISK` adds 40 for the amount, 20 for the new device and 20 for the location. That is 80, which is
**HIGH**. If my previous transfer was in the last 10 minutes, it adds 15 more for speed. So the transaction
is **FLAGGED**, and a fraud alert was created automatically. I did not call any fraud function from the
website. The compound trigger `TRG_FRAUD_MONITOR` did it inside Oracle."

**[Transactions → press F5]**

"After refreshing, both transactions are still here, because they are stored in Oracle."

**7. Alert workflow (≈30 s)**

**[Sign out → Fraud Analyst → Fraud Alerts → open the new alert → Start investigation]**

"As the analyst, I see the new alert at the top, with the reasons. I start an investigation. That updates
`FRAUD_ALERT`, and a CHECK constraint only allows valid statuses."

**8. SQL proof (≈40 s)**

**[Switch to the SQL terminal]**

"To prove this is real data, here are the newest rows in `BANK_TRANSACTION` and `FRAUD_ALERT`. And if I
call `CALCULATE_RISK` on the newest flagged transaction, it returns the same score that was stored in the alert."

**9. Testing and results (≈20 s)**

"I wrote 15 database test cases in `13_testing.sql` for the rules, the triggers, the cursor and the
constraints. The website has automated tests, and the whole install was rehearsed on a clean Oracle
database, where every API check passed."

**10. Limitations (≈20 s)**

"There are limitations. The scoring is rule-based, not machine learning. Transfers are screened, but they
do not move balances. The login is for demonstration only. The public website link runs a clearly labelled
simulation, because the real Oracle database runs on my laptop."

**11. Conclusion (≈15 s)**

"To conclude, SmartBank shows how Oracle triggers, procedures, functions, cursors, packages, views and
indexes can detect fraud automatically and consistently, at the moment data is stored. Thank you. I am happy
to take questions."

---

### Quick answers to likely questions

* **Why a compound trigger?** `DETECT_FRAUD` reads `BANK_TRANSACTION`. Reading it from a row-level trigger on the same table raises ORA-04091 (mutating table), so IDs are collected per row and processed after the statement.
* **Why does a medium alert not flag the transaction?** By design in `DETECT_FRAUD`: MEDIUM needs review; only HIGH is flagged.
* **What does the cursor do?** `REVIEW_HIGH_RISK_ALERTS` walks OPEN HIGH alerts `FOR UPDATE` and moves each one to INVESTIGATING with `WHERE CURRENT OF`.
* **Is the public link the real database?** No. It is a labelled browser simulation of the same rules and sample data. The real database is on this laptop.
